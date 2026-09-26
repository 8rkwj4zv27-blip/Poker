# Showdown pass: the end of a hand

The end of a hand, from the moment betting closes to the next deal, is
built as a set of beats with choices, the way the Enemy Cards were ordered.
Written 27 Sep 2026. Presentation only: pot building (`computePots`), the
share split, settlement, `finishHand()` and Career money stay exactly as
they are.

## What the owner asked for

"The end of a hand, with the showdown, the pot and side-pot distribution,
the card reveals, making it theatrical, the payout, awarding the payout,
some kind of chip smash again." The foundations exist, but this part hasn't
had the polish the rest of the game has. Have some fun with it.

Owner's answers (27 Sep):

1. **AWARD POT** waits for you when you were in the hand or the pot is big,
   so there's time to read the showdown. Small pots between two opponents
   pay themselves after a read. (Lab row: AWARD POT.)
2. **Win chance** (equity) numbers: a setting to switch on or off, at least
   in the lab, to get a feel for them.
3. **The smash:** show options. The coin physics (flipping coins, shunts)
   should make it fun.
4. **Side pots:** paid one at a time, the last side pot first and the main
   pot last. Yes.
5. **Show a bluff after a fold-win:** my call. It's in the lab as an option
   (SHOW KEY), on in my suggested picks.

## What happens today (read 27 Sep 2026)

`handleShowdown()` (05-game-engine.js) sweeps the bet spots into the tray,
turns the opponents' cards over weakest first (the winner last), and works
out every pot. `runShowdownAwardSequence()` (06-presentation.js) flies the
winning five into the rail, stamps the hand name, lights the winning seat,
turns the HUD into the result console and waits for AWARD POT. Then every
pot is paid at once: the tray's coins are split by amount, yours pour
through the hatch and an opponent's are raked and hop home.

Gaps:

- **All-in runouts are flat.** Hands stay face down until the river, and
  the banner said "YOU IS THINKING…" (audit F4).
- **Side pots only exist as text** on the result console. One tray, one
  plate, one burst of coins, so you can't follow "lost the main, won the
  side".
- **Losing hands fade away.** Only the winner's hand is named, so you never
  see what beat you.
- **The coins cover the rail's stamp** (the tray sits right under the
  board).
- **No smash.** It went with the XP (v0.40.6), so $40 and $4,000 feel the
  same. The coin table has a big `heave` payout that nothing uses.
- **Splits have no chop,** and **your loss** has no moment of its own.
- **Glitch found in the lab:** `feltImpactBump()` (06-presentation.js)
  turns the felt brown for a frame. Nothing calls it now the pot smash is
  shelved, but it would show if it were used again. The lab uses its own
  bump.

## The lab: `showdown-lab.html`

The real game runs sandboxed at the owner's phone (430 x 932, like the
other order forms), with the candidate `css/showdown-beats.css` and
`js/showdown-beats.js` injected. Each row is one job; its first option is
TODAY, the game as it ships. With every row at TODAY the game plays
exactly as it ships.

The moments deal a fresh table and play the real game to a showdown: you
win or lose heads-up, 3-way, on the kicker, a big pot, a monster pot, an
all-in suck-out or bad beat, a 3-way all-in, a split, a side pot, three
pots, an opponent winning a small or a big pot, and everyone folding to
you. Winners are set by stacking the undealt deck; the engine settles
every hand for real. You press AWARD POT yourself.

Presets: TODAY, MY PICKS (my suggestion), ALL LOUD (everything at full,
for looking), QUIET MACHINE (clear but calm). COPY ORDER gives the picks
as text for the chat.

### The beats and their options

| # | Beat | Job | Options (first = today) |
|---|---|---|---|
| 1 | The lock | Lock beat | TODAY · RELAY (a clunk, the lights dip, SHOWDOWN on the banner) · CONSOLE (and your buttons flip to a lit SHOWDOWN face, which becomes AWARD POT) |
| 2 | The all-in sweat | Hands | TODAY (face down) · FACE UP · FACE UP + NAMED (each seat names its hand, every street) |
| | | Win chance | OFF · ON SEATS · METER (one bar under the pot, a share per player) · BOTH |
| | | The river | TODAY · SQUEEZE (face down, a wait, a peek, then over) · SQUEEZE + SWEAT (a heartbeat; the faces behind go nervous) |
| 3 | The reveal | Order | TODAY (weakest first) · CASINO (the last bettor shows first, then round the table) · ALL AT ONCE |
| | | Readouts | TODAY · NAME IT (each seat names its hand) · LEADER BOARD (LEADS / BEATEN as the lead changes hands, you included) |
| | | Losing hands | TODAY (dimmed) · STAY READABLE |
| 4 | The verdict | Winning five | TODAY (the rail) · RAIL + DUEL (the best losing five under it: "BEATS …") · IN PLACE (the cards glow where they lie, a stamp on the board) |
| | | Kicker | TODAY · PLATE (a KICKER plate when both hands are the same kind) |
| | | Split | TODAY · STAMP |
| 5 | The pots | Side pots | TODAY (one pile) · OWN STACKS (the tray splits, a plate per pot where the pot plate was) |
| | | Handed over | TODAY (all at once) · POT BY POT (the last side pot first, the main pot last; an uncalled bet goes straight back) |
| | | AWARD POT | EVERY HAND · YOURS + BIG · NEVER |
| 6 | The payout | By size | TODAY · TIERED (small flicks, big heaves off the rim, a monster smashes). BIG from 10 big blinds, MONSTER from 30 |
| | | The smash | NONE · SLAM (the tray is hit, every coin jumps and spins, then pours in) · GEYSER (up out of the tray one by one, over, into the hatch) · AVALANCHE (the tray tips, the pile slides down the felt, over the edge) · RAIN (flung off the top of the screen, raining onto your dashboard) |
| | | Smash when | MONSTER · BIG + · EVERY WIN |
| | | Smash size | TASTEFUL · LOUD (a jolt, the rim flashes) · OVER THE TOP (the machine shakes, the lamps chase round the felt, JACKPOT on the banner) |
| | | Their win | TODAY (raked, then home) · SHOVE (pushed across to their square, then drained into the cup) · SHOVE + GLOAT (the face gloats, the others glance over) |
| | | Split payout | TODAY · CHOP (a blade of light, the halves slide apart) |
| | | Your loss | TODAY · DIM (your dashboard dims with a low thunk) |
| | | The numbers | TODAY (your stack jumps) · COUNT (it counts up coin by coin as they drop in) |
| 7 | Everyone folds | Show a bluff | TODAY · SHOW KEY (beside AWARD POT; the table reacts to a bluff or a real hand) |

### How the candidate works (for the build later)

`js/showdown-beats.js` replaces `handleShowdown()` and
`runShowdownAwardSequence()` with copies whose pot, share and settlement
code is the production code verbatim, and wraps `advancePhase()` (the
runout), `dealCommunity()` (the river squeeze), `updateHandInstrument()`
(your hand screen's tags), `EnemyCards.paint()` (their cards stay out
through a runout) and `startNewHand()` (the clean-up). Coins are handed to
the coin table's own `CoinTable.payout()`, so the hatch, rack and sounds
are the game's. The smash takes over only the throw into your hatch.
Plates, stamps, the duel and the meter sit in one overlay (`.sd-layer`)
above the coins.

## Plan after the owner's order

1. **Release 1: the reveal.** The lock, the reveal order and readouts,
   readable losing hands, the verdict choice, KICKER and SPLIT. Fixes the
   stamp under the coins.
2. **Release 2: the pots.** Side-pot stacks and plates, pot by pot, the
   AWARD POT rule.
3. **Release 3: the payout.** Tiers, the chosen smash and size, their win,
   the chop, your loss, the counting stack.
4. **Release 4: the all-in sweat.** Hands up, the win chance (with its
   setting), the river.
5. **Feel pass.** Sound, Reduced Motion, Quick Resolve, timing per tier, a
   `showdown-checks.js` suite (money settled is identical to today's for
   every fixture). New parts (the meter, the plates, the duel, the pot
   plates) go into `docs/ui/PATTERN_BOOK.md` and
   `validation/pattern-book-checks.js` before they ship.

Each release bumps `BUILD_VERSION`/`CACHE_NAME` and the `?v=` of every
changed file.
