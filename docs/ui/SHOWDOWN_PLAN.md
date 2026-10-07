# Showdown pass: the end of a hand

> **Historical.** The showdown shipped in v0.42.0 (27 September 2026). The phone-first lab pattern it started is in `CLAUDE.md` ("Visual labs") and `showdown-lab.html`. The code, `docs/CODEMAP.md` and `docs/HANDOVER.md` describe the game today. Index of current docs: `docs/README.md`.

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

## Round 1 order and round 2 (27 Sep 2026)

The owner's round-1 order: lock CONSOLE · hands FACE UP + NAMED · win
chance METER · river SQUEEZE + SWEAT · order CASINO · readouts LEADER
BOARD · losing hands STAY READABLE · winning five RAIL + DUEL · kicker
PLATE · split STAMP · side pots OWN STACKS · POT BY POT · AWARD POT EVERY
HAND · TIERED · smash SLAM on MONSTER, LOUD · their win SHOVE + GLOAT ·
CHOP · your loss DIM · COUNT · SHOW KEY.

Feedback, and what round 2 does about it:

- **The smash wasn't fun or earned enough, and the casino lamps and
  JACKPOT sign had to go.** Both are gone. On a monster pot AWARD POT
  becomes HOLD TO SMASH. Holding charges it in nine notches: the key's
  gauge fills, a ratchet climbs, your dashboard hums and the machine winds
  up in the style's own way. Letting go fires it as hard as you charged.
  Then the pour: one coin at a time into the hatch, each clink a step
  higher, the stack counting with them, and a thunk and a clack to finish.
  - SLAM: a brass press drops in over the tray and cocks back; it comes
    down with a hit-stop and every coin jumps.
  - GEYSER: pressure rattles the coins; they fire straight up one after
    another, **hit the table's top frame and are thrown back down**
    (owner's ask), bouncing off the cards.
  - AVALANCHE: each notch tips the tray and the pile creeps; the release
    sends it down the felt and over the edge.
  - RAIN: the tray is a spring; the pile is flung up, **hits the top
    frame** (owner's ask) and comes down across the dashboard, off its rim
    and in.
  Owner: press and hold, yes. Big pots stay a plain tap (a heavier pour).
- **The winning hand's plate sat under the pot's coins.** It's now a
  nameplate on the rail's top edge (HAND NAME · ON THE RAIL), with KICKER
  beside it.
- **The rim light overlapped their cards.** At the showdown their cards
  slid out behind the cabinet, so its rim glow (up to 12px on a win) and
  its base shadow drew over the card tops. They now sit in front of the
  cabinet and 9px lower (THEIR CARDS · CLEAR OF THE RIM). The gold rings
  round LEADS/WIN cards are gone; the readout carries it.
- **Player settings** (owner: yes). Settings → Showdown in the game:
  the smash (Slam, Geyser, Avalanche, Rain, Off), Win chance (the meter,
  on/off) and Award pot (Every hand, Mine + big, Never). In the lab the
  section is live in the game's own Settings sheet and in section 8 of the
  form. In the real game the win chance should default off.
- Also fixed: the table bump no longer scales the stage (a scale turns
  the felt brown for a frame, the same cause as `feltImpactBump()`).

## Round 3: the cook (27 Sep 2026)

Owner: no press or machinery; remove the other options and keep the
round-1 order (locked in, with the round-2 fixes). The smash becomes **the
cook**, kept simple so the coins do the satisfying part:

1. **Hold AWARD POT** on a monster pot: the pot's recessed well glows and
   heats in steps, cooking the coins (they redden, rattle, throw embers),
   a ticking sizzle climbing, the dashboard humming.
2. **Let go: BANG.** The well flashes and snaps cold; the coins fire off
   it, spin, bounce off the cards and the top frame, and cool to gold.
3. **Settle**, a beat.
4. **Into the bank**: one by one each coin flips up off the felt and arcs
   into the hatch, the stack counting, a thunk and a clack to finish.

Every part is a lab row for the owner to tune (heat colour, time to full,
steps, the coins, rattle, embers, sound, letting go early, full heat,
force, direction, top frame, hit-stop, jolt, cooling, settle, the flip,
pace, finish). Player settings are now Win chance and Award pot only.
Also fixed: the form's picks never reached the game copy (the candidate
wasn't on the frame's window), which is why styles snapped back to Slam.

## Round 4: a physical bang, a calmer cook, a phone lab (27 Sep 2026)

Owner: the cooking visuals are great, but the pop was anticlimactic (the
coins barely bounced) and the jumping while cooking looked like a bug.
The lab didn't work on their phone.

- **The bang** is now flown by hand in screen space, like the original pot
  smash: gravity pulls down the screen, the screen's edges (or the table's
  rail) are walls, the table's bottom rail is the floor, and the cards and
  cabinets are solid. Each coin bounces 4–6 times, flipping, rolls out on
  its edge, wobbles and lies flat (about 2–4 s), then flips into the bank.
  Rows: force, bounces, walls, roll out.
- **The cook** no longer makes the coins jump: they shiver a pixel or two
  in place, harder as it heats, and when it's really hot one hops and
  lands now and then.
- **The lab is phone-first**: the game full screen with a TUNE key and a
  bottom sheet; the bundler bakes the game copy for the link. A long press
  on AWARD POT no longer selects text or opens a callout on iOS.

## Round 5: the explosion on the table, AWARD POT stays AWARD POT (27 Sep 2026)

Owner: the explosion looked sped up (cook to resting in half a second) and
the coins came to rest on the dashboard rim and on their cards. It should
arc up out of the tray, bounce off the walls, dashboard and enemy cabinets
and off the felt, a few arcs, and settle as a big mess on the table; only
then do they pick themselves up into the bank. The key should just say
AWARD POT: a tap is the full show, a hold goes wilder. The lab should cut
straight to AWARD POT and replay.

- **Why it was sped up:** the explosion ran on the coin world's clock,
  which follows the game speed; the lab's fast deal left it at about 6×.
  The explosion now runs on real time, always (checked with the game on
  Fast and the coin clock forced to 6×: 3.6–4.2 s).
- **On the table:** the coins are flown like the bets are: a spot on the
  felt and a height, shadows on the felt. They arc out of the tray, bounce
  3–4 times on the felt (lower each time, flipping), knock off the rails,
  the top frame, the enemy cabinets and their cards, the board, your
  cards, the deck and the dashboard's edge (padded hitboxes with heights:
  high arcs fly over low things), slide or roll, wobble, and lie in a mess
  across the felt. Nothing may rest on a solid: a coin that stops on one
  is moved to the nearest clear felt (checked: none left on a solid).
- **AWARD POT:** the key keeps its label and has no gauge. A tap flares the
  pot for a moment and fires; holding keeps it cooking and fires harder the
  longer it cooked.
- **The lab:** SMASH AGAIN (and an AGAIN key) refills the pot and cuts
  straight to AWARD POT, as often as wanted; the hand underneath waits.
  The pick-up is a row (one by one, quick ripple, all at once).

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

## Shipped: v0.42.0 (27 Sep 2026)

The owner approved round 5 and asked for it in the game with the player
able to fine-tune it. One release rather than four: `js/showdown.js` +
`css/showdown.css`, generated from the candidate at the owner's order.

- Settings → Showdown: the smash (monster pots by default / big pots /
  every win / off), force, bounces, heat, into your bank, win chance (off
  by default) and when AWARD POT waits. Everything else is fixed at the
  order.
- `validation/showdown-checks.js`: the pot/share/mood/settlement code is
  production's verbatim, the display merge keeps every chip, the settings
  are wired. Pattern Book: a Showdown entry and check.
- Played on an emulated iPhone against the real game: monster pot (tap and
  hold), split, loss, fold win, one and three side pots, and you covering
  every all-in; every player ended with exactly the engine's shares.
- Fixed on the way: the runout used to lock the console when the one
  player not all in was you (the engine still asks you to act each street,
  so the hand stalled). The runout show now only plays when nobody left to
  act is you.
- The lab strips the shipped files from its copy and keeps working as the
  place to try other options.
