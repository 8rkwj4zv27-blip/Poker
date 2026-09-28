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

**Owner, 26 Sep 2026 (later):** the XP is shelved: the score bar, the
award messages and the rest come out of the game for now, and scoring gets
its own plan later. **Done in v0.40.6** (release 1 of the spacing pass):
`ARCADE_XP_ON = false`; see the note atop `SCORING_SPEC.md`. The spacing pass is for the owner's phone only (iPhone
15 Pro Max, installed app); other sizes come later. Board cards stay their
size: the aim is room for things the game may add later, not bigger parts.

`table-space-lab.html` is the lab for it (see `docs/CODEMAP.md`): every
proposal from the review as a live control on the real game at that
phone's size, with meters. Measured there (4 opponents): today the felt is
476px; SAFE (score bar gone, top bar trimmed) 565px; MODERATE (plus slimmer
opponent pods, bet boxes, a compact dashboard) 587px; BOLD (no top bar,
actions in the name strip, deck in the corner) 639px. The owner picks
settings there and pastes them back; the build follows from those.

**The owner's picks (26 Sep 2026)** from the lab, for release 2 (layout):
score bar and top bar gone (no gap under the status bar); the settings key
in the dashboard's right bay (in place of the speaker grille); SAVE moves
into the settings menu; no hand/blinds print on the felt, and a short
"BLINDS UP" card pops in between hands when the blinds rise (like the
event ticket in the table intro); their cards 95%; opponent row +2px;
their bet spots -10px; shared cards 53% (the owner asked for them a little
lower than the 50.5% picked in the lab); pot counter 77.5%; pot coins above
the counter in the rounded area, 210 x 62; deck 16% across, 88.5% down;
your bet spot above your cards; your cards poke up 55px; button bay 98px;
buttons 51px; gap above the home bar 21px. Everything else as today.
Lab link with these: `table-space-lab.html#score=off&top=gone&topGap=0&gear=dash&hole=95&podY=2&oppDrop=-10&boardY=53&potY=77.5&trayW=210&trayH=62&deckX=16&deckY=88.5&you=centre&rise=55&actH=98&btnH=51&foot=21`.

**Release 2 shipped (v0.40.7, 26 Sep 2026)** with those picks: the rules
are one block at the end of `css/05-responsive-and-arcade.css`; the pot
tray (210 x 62) and the bet spots (theirs 10px nearer their cards, yours
above your cards) are in `layout()` in `js/coin-table.js`; the settings key
is in `#hud-right` in place of the speaker grille, SAVE is in the settings
sheet's "This table" row, and the top bar is hidden (`#table-meta` stays in
the markup). BLINDS UP is `TableIntro.blindsUp()` (`js/table-intro.js`,
styled in `css/table-intro.css`), awaited by `startNewHand()` when the
blinds rise after a table's first hand (tournament and Career events). The
lab's TODAY is now this layout, and a BEFORE preset shows the old one.

**v0.40.8 (26 Sep 2026), from the owner's phone (a 3-handed Career table):**
tables of 1-3 opponents now have authored seat maps (`SEAT_MAPS` in
`js/06-presentation.js`, level with the 4-opponent map: centre 8.5%, outer
11.5%); the generic ellipse had put the centre seat on the top rail and
the outer seats so low that their bet spots fell on their own cards. 1-3
opponents also take the 4-opponent seat size (faces a touch smaller). Bet
spots can no longer overlap a seat's cards: `layout()` measures the cards
as dealt (a stand-in card before the deal), keeps each spot's coin base
D+18px below them, re-lays whenever a seat's card row moves (a house
game's hearts row appears after the blinds are thrown; `render()` calls
`CoinTable.layout()`, a no-op otherwise), and tidies coins already down
onto the new spots.

## Denominations: the coin economy pass (27 Sep 2026)

Owner, playing: coin counts don't add up. Your bets throw one coin
whatever the size (your throw was the rack's drop in coins, and the rack
curve flattens at big stacks: $400 from $3,000 threw 2 coins while an
opponent's $400 threw 12); opponents fall to one coin once the table fills
(the pot + spots limit of 60, "at least one coin"); counts were in fixed
dollars (a $20 big blind). Wanted: consistent, sized by the bet, a proper
pile of gold that never breaks the table.

**Settled with the owner:**
- Three pieces, a fixed ratio: SMALL coin = the small blind (it follows
  the blinds; a rate key on the pot plate says what a small coin is
  worth), BIG coin = 5 small, BAR = 5 big.
- As many pieces as possible: a bet throws one small coin per small blind
  up to a limit; past it, five of the commoner kind change up into one of
  the next, only until it fits (so a big bet stays a mix). Same rule for
  you and every opponent.
- The pot keeps a full-size pile and gets richer: after each sweep, over
  its limit, five pieces change up in the tray (the first few shown: hop
  up, clink, pop into the bigger piece, drop back).
- One kind of piece per tower, so the no-clipping stacking rules still
  hold, run with each piece's own size. Bars rest as boxes.
- Your bank is its own lab later (the owner wants more thought on it).

**Lab 1 (`coin-denom-lab.html`):** the pieces and the pot. Big coin looks
(RING, DEEP GOLD, PLAIN) and size; bar looks (INGOT, BRICK) and length;
limits per bet (16), all-in (24) and pot (60); the change-up shown (first
3 / every one / at once); the rate key (small coin / all three / off);
COUNTING NEW vs TODAY. Moments deal real hands to each bet size, a 3-way
and a 4-way all-in (change-ups), and late blinds (300/600). The pot tidies
in bands, small coins in front, big behind, bars at the back standing
taller than the pile in front so they show. Known gaps for production:
split and side pots still share the tray's pieces by count, not value
(`js/showdown.js`); your wins' bigger pieces melt in at the hatch until
the bank lab.

**Lab 1 verdict (owner, 27 Sep 2026):** "looks really good". The pieces,
the counting rule and the pot change-up stand as built (first option of
every row). On to the bank.

**Lab 2 (`coin-bank-lab.html`): the bank's inside.** Same housing
(#hud-left, 90 x 155; the inside is 76 x 134, tall and narrow, so the wide
vault tray first proposed became three portrait styles). Your stack is
shown as the felt's pieces at the small blind, as many as each column
holds (small coins until their column is full, then five change up). The
first of each is the suggestion:
- TUBES: a coin changer. Three glass tubes (small, big, bars) on a brass
  plinth tagged with each piece's value; coins stack edge-on like a coin
  roll, pay out from the bottom (the column drops), wins drop in at the
  top of their own tube. The fill levels are the stack.
- SHELVES: a lit velvet display case: small coins on the top shelf, big
  coins in the middle, bars on the floor.
- HOPPER: a glass tank of mixed gold with a brass fill line.
- TODAY: the shipped rack, to compare.
Making change plays out in the bank: a bet that needs small coins the bank
hasn't got breaks a big coin into five first; after a bet or a win the
bank settles to the stack (breaks, change-ups, then top-ups or lifts). The
bank never holds more than it shows room for (a very deep stack fills
every column; the STACK readout keeps the figure).

**Shipped (v0.44.0, 27 Sep 2026), the owner's picks:** big coin RING
1.4x, bar BULLION 1.75x (chosen from STAMPED / BULLION / TREASURE), 16 a
bet, 24 all in, 60 in the pot, the change-up's first 3 shown, no rate key;
bank TUBES, tags OFF, making change SHOW 3. The lab candidates became the
game's `js/coin-world.js` / `js/coin-table.js`, plus `js/coin-bank.js` /
`css/coin-bank.css`. Settings → Bank: TUBES / SHELVES / HOPPER / CLASSIC
(the old rack), tube tags, making change (`settings.bankStyle`,
`bankTags`, `bankChange`; existing settings untouched). Still to do: split
and side pots share the tray's pieces by count, not value (`js/showdown.js`
`coinsFor`/`splitCoins`/`chop`).

**The bank, rounds 2-3 (27 Sep 2026).** Owner on the shipped TUBES: works,
but confusing (what is it? and the change-making inside adds to it). NEW
TUBES (`coin-tubes-lab.html`) read better but didn't answer that. Settled
direction: the bank looks like the pot. `coin-hoard-lab.html`: the HOARD,
a coin-world zone in the bank's box (the world copy gains box zones: walls
= the box, a 40px floor strip, piles under its top). A few pieces for a
short stack, a heap near 100BB (HOW BIG: .3/.45/.65 pieces per BB, max
52), then every kind at its cap (20 small, 18 big, 14 bars; past that it's
full, the STACK readout exact). Wins wait for the bank to be back on
screen (the award swaps the dashboard out), then land on it for real and
the pile settles into its heap shape; bets come off the top; a tap tidies
to a pyramid; gleams by depth (40BB, 80BB, a sparkle across it past
100BB). No change-making on screen: value is settled quietly after a
payout and at each hand. Measured: 0 overlaps and 0 pieces outside the box
at every size (the loose landing heap before it settles can overlap).


**Lab links (owner's phone, private Artifacts):**
- Coin Denominations Lab (`coin-denom-lab.html`): https://claude.ai/artifact/RLR5LuEj6BnSV14uLcgvSN
- Coin Bank Lab (`coin-bank-lab.html`): https://claude.ai/artifact/QBFNjCANf2xFi9m6jsDHot
- Bank Tubes Lab (`coin-tubes-lab.html`): https://claude.ai/artifact/5cMSBi4UEys2BoCYHnRWM2
- Hoard Lab (`coin-hoard-lab.html`): https://claude.ai/artifact/CFtJ2Uk69961wxm1k1d4oQ

**Round 4: chip coins (28 Sep 2026).** Owner on the hoard: coins drawn
over the raise panel; a big pot overflowing into a climbing loop; bars
lost behind big coins. Decision: poker-chip coins, one size, value by
colour, the bank a pot of them, in and out through a slot; gold shouldn't
be the lowest value. `chip-lab.html`: tiers x5 (1, 5, 25, 100, 500, 2500
small blinds); LADDER ivory-red-green-black-purple-gold (suggested; gold
is the top prize), silver-...-gold, or gold lowest; COLOURS muted/casino;
eight DESIGNS (spots, enamel, tint, ring, gem, bimetal, casino, rim). The
bank: colour-sorted stacks in the hoard's box (each colour a share of the
stacks, richest in the middle), THROUGH A SLOT (wins stream in one by one
and drop onto the pile; bets hop out and on) or over the top. Fixes: the
bank's resting coins hide while anything covers the box; pot and box
stacks may reach 10 on a landing, so a 4-way all-in settles instead of
climbing. Measured: 0 overlaps / 0 outside the box at every stack size;
the bank equals the stack exactly (no cap with chips); a 4-way all-in
leaves 0 stuck coins.
- Chip Lab (`chip-lab.html`): https://claude.ai/artifact/RYebkxQ3gm769G7Yq32kLV

**Round 5 (28 Sep 2026).** Owner's picks: TINT, CASINO colours, SILVER up
to GOLD, through a slot, pyramid, big, gleam when rich. Issues: coins
jumping on the pile and floating out of the pot until a tidy; the bank's
back stacks hidden; a pour spilling out of the bank and a heap cropped by
its top. Changes (same link): every coin now lands in its exact place,
planned before it's thrown (`planZone`; the pot and the bank slide over
to make room, coins thrown lowest places first), so nothing searches for
a spot; the bank is one row of stacks (`rackSlots`: a pyramid outline,
richest in the middle, nothing behind anything); the pot's change-ups are
quiet; the tray is 250 x 66. The bank's size: about 80-90 coins (the
rack's room); how many your stack earns follows a gentle curve (a few
stacks at 25 BB, half full near 1,000 BB, full only at massive numbers);
the settle composes the whole bank's colour mix for the stack, so it can
never hold more than it has room for. The money has no limit: past
all-gold-and-full the bank simply stays full (the readout carries on).
Eight more designs next to TINT (FLAT, DUO, HOLLOW, STAR, DASH, CANDY,
STRIPE, TARGET). Moments: HUGE POT (5-way, 150 BB), POT STRESS; YOUR BANK
presets ($500 to FULL); WINNINGS one by one or handfuls. Measured: 0
overlaps and 0 outside the box from $500 to $3M; a 5-way all-in settles
with 0 stuck.

