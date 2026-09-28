# AI plan: opponents who play like people

Owner-approved 2026-09-28. Goal: opponents who play real, readable poker,
with skill that rises through the Career venues. Low-stakes rooms are
beatable with fundamentals; the top rooms are strong players who spot and
punish your leaks. What you learn at the table should carry over to real
poker.

This plan covers **gameplay only**. Personality, dialogue, faces and
designed tells come later, in their own pass.

## Ground rules

- **No cheating, ever.** The AI never sees hole cards or the deck. Every
  read comes from public actions.
- **Poker rules and hand evaluation don't change.** Anything that speeds up
  hand evaluation must match `evaluate7` exactly, checked exhaustively.
- **No dependencies, no framework.** Vanilla JS; the heavy maths stays in
  the equity worker.
- **Keep the `difficulty` field and its values** (`medium` / `hard` /
  `expert` / `elite`, plus Custom Game's `easy`). The value becomes the
  **tier**. Saves and Career events keep working unchanged.
- **Keep gameplay mood (`moodState`) and face mood (`faceMood`) separate**,
  as they are today.
- **Every step ships on its own and is proven with numbers**
  (`validation/tools/ai-sim.js`), not by feel.

## Where we started (2026-09-28 audit)

`aiDecide()` works out its equity against *random* hands, adds a random
bluff roll to each decision, and caps how much of its stack it will
commit. In the measuring table (Hard, before any change):

| | VPIP | PFR | AF | WTSD | Fold to bet |
|---|---|---|---|---|---|
| Shark | 32% | 6% | 0.7 | 58% | 19% |
| Maniac | 53% | 18% | 1.2 | 61% | 18% |
| Prof | 27% | 5% | 0.6 | 65% | 18% |
| Wildcard | 47% | 10% | 0.8 | 63% | 18% |

*VPIP = hands played; PFR = preflop raises; AF = aggression factor (bets
and raises per call); WTSD = went to showdown after seeing the flop.*

Problems found:
1. They play against random hands, never against *your* likely hands.
2. Bluffs are independent coin flips on each street, so they tell no story
   and follow no plan.
3. There's no line across streets: no c-bet logic, no deliberate
   check-raise, slow-play or barrel.
4. Raises and all-ins are only ever strong (all-in needs about 82% equity),
   and bet size tracks hand strength (correlation 0.4–0.5).
5. Everyone is a passive calling station: they limp heavily, and about 60%
   of flops go to showdown.
6. There's no adaptation: they keep bluffing a player who never folds.
7. Difficulty is only sampling precision plus random error. Easy and Hard
   played almost identically.
8. **Bug:** `seatsAfter()` counted every live opponent, so position never
   affected any decision. Fixed in Step 1.
9. Think time is longer for bets and raises (`aiThinkTime`), so the length
   of the pause leaks the coming action. To address in Step 3.

## The tier ladder

The difficulty value is the tier. Skill is made of **leaks** (consistent
mistakes), **reading** (narrowing down your hand), **balance** (sizing that
doesn't give their hand away) and **adaptation** (how fast they punish your
habits). Personality is a separate axis: Tony is a maniac at every tier,
just a better one higher up.

| Tier | Venues | Who they are | What beats them |
|---|---|---|---|
| `medium` | Back Room | Recreational: call too much, rarely raise, random bluffs, never adapt | Value-bet good hands; don't bluff callers |
| `hard` | Pub Circuit, Card Club | Amateurs: some aggression, obvious bluff patterns, sizing tells | Pot odds, reading sizing, calling down bluffers |
| `expert` | Casino Floor | Good regulars: positional ranges, multi-street lines, balanced sizing, begin tracking you | Hand reading, bluff selection, pot control |
| `elite` | High Roller, Invitational | Strong: close to balanced, adapt quickly | Playing without patterns; not tilting |

### Skill is a dial, not a list

Owner requirement: rooms must be easy to add or retune anywhere on the
scale (an even softer room, one between two tiers), and a Custom Game
should be able to offer a skill slider. So:

- **Skill is one number, 0–100.** The named difficulties are anchor points
  on it: `easy` 15, `medium` 30, `hard` 50, `expert` 70, `elite` 90
  (`SKILL_ANCHORS` in `js/03-opponents.js`).
- **Every skill-dependent setting is defined at the anchors and blended
  between them** (`skillBlend`). This covers leak strength, reading
  accuracy, balance, adaptation speed, sampling precision and position
  weight. Skill 40 really does play between Back Room and Pub. Below 15 or
  above 90, a setting holds its end value.
- **Where skill comes from** (`aiSkillOf`): the seat's own `skill` first,
  then the table's `g.skill`, then the table's named `difficulty`. That
  gives three levers:
  - a room keeps `difficulty:'hard'`, or sets a number instead;
  - a Custom Game slider sets `g.skill`;
  - one seat can out-skill its table, such as a single regular sitting in
    the Back Room.
- **A named difficulty on its own plays exactly as before.** This is
  checked, so existing rooms and saves don't move.
- **Personality stays separate from skill.** A Tony at skill 20 and a Tony
  at skill 85 are both maniacs.
- **New AI knobs must be added as per-anchor tables, never as `if (tier
  === 'elite')` branches.** That's the rule that keeps the dial working.
- **Measuring:** `ai-sim.js --skill 40`, or `--skill sweep` for 10…100. The
  sweep should show the `abc` yardstick's win rate falling steadily as
  skill rises. Step 6 turns that into a check.
- **Not built yet:** saving a numeric table skill with a table in progress
  (the table save format has no field for it), and the Custom Game slider
  itself. The slider will be a number wheel from the Pattern Book. Both
  arrive with the UI step once there's real skill to adjust.

Provisional stat bands for each tier live in `TIER_TARGETS`
(`validation/tools/ai-harness.js`). Once the AI reaches a band, that band
becomes a check in `validation/ai-behaviour-checks.js`. The yardstick is the
`probe:abc` seat (a plain, decent player). It should clearly beat `medium`,
roughly break even at `hard`/`expert`, and lose to `elite`.

## Steps

### Step 1: measuring stick and position fix — DONE (v0.50.0)
- `validation/tools/ai-harness.js`: the real `aiDecide()` in a small,
  rules-correct NLHE table. It uses seeded RNG and adds three test seats:
  `bully`, `station` and `abc`.
- `validation/tools/ai-sim.js`: a per-seat report against the tier targets,
  split across worker threads.
- `validation/ai-behaviour-checks.js`: position tests, harness sanity
  checks and repeatability.
- `seatsAfter()` now measures from the dealer button, so the
  `positionWeight` ladder finally does something.
- The skill dial is in place: `SKILL_ANCHORS`, `aiSkillOf`, `skillBlend`
  and `aiDifficultyParams`. `aiDecide()` reads its settings through the
  dial. Named difficulties are unchanged; `ai-sim.js` takes `--skill`.

### Step 2: hand reading foundation — DONE (v0.51.0)
- **Fast evaluator** `fastScore7` (`01-poker-math.js`): one integer per
  hand, ordered exactly as `evaluate7`. The checks prove it on all
  2,598,960 five-card hands (`--full`) and on 100,000 random 7-card
  showdowns. It's about 60× faster: an Elite 4-way equity takes around
  11 ms. `estimateEquity` runs on it. Showdowns and hand names still use
  `evaluate7`.
- **Starting-hand order** `PREFLOP_ORDER`: 169 classes, generated by
  `validation/tools/preflop-order.js`. It blends equity heads-up and
  against three random hands, with a small implied-odds nudge for pairs
  and suited connectors. `preflopPercentile` gives a hand's place among
  all 1326 combos.
- **Equity against ranges** `estimateEquityVsRanges` ("their best X%"),
  also available in the worker through `EquityService.get(..., ranges)`.
- **Preflop from ranges** `aiPreflop` (`03-opponents.js`):
  - unopened: open, limp or fold by seat;
  - limpers in: isolate or over-limp;
  - facing a raise: estimate the raiser's range from their seat and the
    raise count, then compare realised equity against that range with
    the pot odds, and 3-bet, call or fold;
  - short stack: push or fold.

  Skill leaks are the `PREFLOP_SKILL` per-anchor table on the dial:
  position awareness, reading, limping, stickiness, 3-bet bluffs, the
  size tell and blur.
- **Engine:** public betting history (`g.streetRaises`,
  `g.streetAggressorId`, `g.pfAggressorId`).
- **Postflop hand class** `classifyPostflop`: made hand (top pair, overpair,
  set and so on), draws (flush, nut flush, OESD, gutshot, backdoor) and
  texture. It's built and checked; Step 3's decisions use it.
- Postflop decisions are **unchanged** in this step.

### Step 3: postflop lines, sizing and defence — DONE (v0.52.0)
- **Judging a hand against a range:** `rangeRelStrength` in
  `01-poker-math.js` answers "where does my made hand sit within the range
  I'd have here?" After calling a bet, the range narrows (`aiPlan.scale`),
  so the same hand ranks lower on the next street. Weak players judge in
  absolutes instead (`MADE_ABS`: "I've got top pair!"). `rangeThink`
  blends the two.
- **Betting** (`aiPostflop`, `03-opponents.js`):
  - value-bet the top of the range, wider as the preflop aggressor and in
    position, narrower multiway;
  - bluff in proportion to the bet size (size ÷ (1 + 2×size) of bets),
    with draws first; stabs are random for weak players;
  - check the middle; monsters sometimes check to trap.
- **A plan per hand** (`player.aiPlan`): value, bluff, semi-bluff or trap.
  A bluff keeps firing when a scare card lands (overcard, third suited
  card, straightening card) and mostly gives up on blanks. A trap looks
  for the check-raise.
- **Sizing from the board and street, the same for value and bluffs:**
  flop ⅓ pot on dry boards, ⅔ on wet ones; turn ⅔; river ¾; with
  occasional polar overbets at the top of the dial. Weak players size by
  strength (`sizeTell`), a tell worth learning.
- **Defence:** skilled players defend about the minimum defence frequency
  (shared among everyone facing the bet), plus draws getting the right
  price. Weak players call with any pair and fold air ("fit or fold"),
  and tight ones fold more to big bets. Hands that can't commit don't call
  off the stack; how much of the range may commit depends on
  stack-to-pot ratio.
- **Raises:** value raises from the top of the continuing range (traps
  become check-raises); semi-bluff raises with big draws.
- **Think time** (`aiThinkTime`) comes from the spot: pot, bet faced and
  street. How much the chosen action leaks into it is `timingTell`: real
  timing tells in the Back Room, none at Elite.
- Skill leaks are the `POSTFLOP_SKILL` per-anchor table on the dial:
  `rangeThink`, `read`, `bluffPlan`, `trap`, `sizeTell`, `mix`, `sticky`
  and `timingTell`.
- **Engine:** `g.prevAggressorId` (who bet last street) and `g.pfRaises`.

### Step 4: reading hands from the betting — DONE (v0.54.0)
- **The hand's public action log** `g.handLog` (`{id, n: board length,
  a: b/r/c/k}`) is kept by `aiObserveAction`.
- **Narrowing** (`01-poker-math.js`): each opponent's range is their
  preflop range with every hand weighted by how likely a normal player
  would make their actual actions with it (`NARROW_W`, by hand bucket on
  each street's board: strong made, top pair, middle, weak, strong draw,
  weak draw, nothing). A known bettor's bluff rate from the notebook
  (`bluff`) lifts the weight of draws and air behind their bets.
  - How hard a player narrows is their reading skill (`k` = `read`; the
    Back Room barely does).
  - `estimateEquityVsRanges` takes these range specs, and so does the
    worker, which caches each combo's weight per call.
- **Decisions** (`aiPostflop`):
  - equity is now against the narrowed ranges;
  - facing a bet, a reader folds when the betting says they're clearly
    beaten and calls when it says they're clearly not, with probability
    `read`, over range balance;
  - they value-bet when the narrowed ranges say they're ahead;
  - a reader only value-raises when also ahead of what the betting shows.
    This fixed a real flaw: Elite was value-raising top pair into a
    check-raise-and-barrel line.

### Step 5: reading the players — DONE (v0.53.0, before Step 4)
Brought forward because Step 3 showed that Elite over-folded to a player
who raises everything. Only reading that player's habits fixes it.

- **The table's notebook** `g.reads[playerId]` (`03-opponents.js`, READS)
  holds public habits only:
  - hands, VPIP and PFR;
  - postflop aggressive versus passive actions;
  - bets faced and folded to;
  - c-bet chances and c-bets taken;
  - river bets shown down, and how many were bluffs.

  Folded cards are never seen; hands are read only when they're shown
  down. Engine hooks: `aiObserveHandStart` (deal), `aiObserveAction`
  (`applyAction`) and `aiObserveShowdown` (both the engine's and the live
  `showdown.js` showdown). The notebook is saved with the table
  (`serializeTable.aiReads`, restored and sanitised), so a Career event
  remembers you across a reload.
- **Each AI reads the notebook through its own eyes** (`aiReadOf`). It
  starts from a normal player (`READ_PRIOR`) and pulls toward what it has
  seen by `trust × n/(n+20)`, where trust = skill `adapt` × temperament
  `personality.adapt`. The Back Room (`easy`/`medium`) has `adapt` 0 and
  never notices. The Professor adapts fastest; Mavis the station almost
  never does.
- **What changes:**
  - a habitual raiser's range is read wider, preflop and postflop
    (`readWidth`);
  - habitual bettors and shown-down bluffers get called down more;
  - players who never fold get almost no bluffs and thinner value bets;
  - players who fold too much get bluffed more.
- **Real tilt:** a big loss with a real hand (`steamed`) now makes a
  player looser, pushier and bluffier, scaled by `personality.tilt` (Tony
  0.9, the Professor 0.15) and reduced by skill. Before, it only tightened
  them slightly.

### Step 6: tier tuning
- Tune leaks, reading and adaptation per tier until each tier sits in its
  bands. Then promote the bands to checks. `easy` stays as a Custom Game
  choice below `medium`.

## What the player should notice

- Raises mean different things from different seats and different players.
- Fewer showdowns, more folding and raising; the game feels sharper.
- Real bluffs: two- and three-barrel stories, check-raises, river traps.
- Over an event, the good players adjust to your habits. The Back Room
  never does.
- Each venue shuts down a trick that used to work below it.

## Running it

```
node validation/ai-behaviour-checks.js            # ~10 s
node validation/tools/ai-sim.js                   # all tiers, 400 hands each, a few minutes
node validation/tools/ai-sim.js --difficulty hard --seats maniac,shark,probe:bully --hands 800
```

Win rates (bb/100) need thousands of hands to mean much. VPIP, PFR, AF,
WTSD and fold-to-bet settle within a few hundred.

## Baselines

After Step 1 (position fix in), seed 1, 400 hands for each table. Seats:
maniac, professor, wildcard, shark + one test seat. AI figures are the
average of the four AI seats.

| Tier | VPIP | PFR | AF | WTSD | Fold to bet | Size tell | `abc` bb/100 |
|---|---|---|---|---|---|---|---|
| medium | 36% | 8% | 0.8 | 61% | 19% | 0.45 | **+168** |
| hard | 38% | 9% | 0.8 | 64% | 17% | 0.44 | **+86** |
| expert | 39% | 8% | 0.8 | 63% | 18% | 0.42 | **+101** |
| elite | 42% | 10% | 0.7 | 63% | 17% | 0.43 | **+327** |

Headlines:
- The tiers are indistinguishable, and the plain `abc` player beats every
  one of them, Elite included.
- Every tier misses its bands in the same direction: too passive, too
  sticky, sizing that gives the hand away.
- Against `probe:station` (never folds) the AI still bluffs 12–21% of its
  postflop bets. It doesn't adapt.
- Against `probe:bully` (raises every hand) the AI's VPIP drops and WTSD
  falls to about 33%. The bully wins +71 bb/100 with no reads at all.

### After Step 2 (v0.51.0)

Seed 1, 2000 hands for each table (1200 for the test seats). AI averages:

| Tier | VPIP | PFR | AF | WTSD | Fold to bet | `abc` bb/100 |
|---|---|---|---|---|---|---|
| medium | 48% | 15% | 0.8 | 57% | 24% | +45 |
| hard | 41% | 18% | 1.0 | 61% | 19% | +15 |
| expert | 36% | 20% | 1.2 | 66% | 15% | +45 |
| elite | 34% | 21% | 1.4 | 67% | 13% | −20 |

- **Preflop now follows the dial.** Across the sweep from skill 10 to 100,
  VPIP falls steadily (48 → 34%) and PFR rises (11 → 21%). Weak players
  limp and call raises light. Strong ones raise or fold and respect
  position.
- **The bully is beaten:** `probe:bully` (raises every hand) went from
  +71 to **−131 bb/100** at `hard`.
- **Still to come:**
  - Postflop is unchanged: WTSD 57–67% and fold-to-bet 13–24% stay far
    too sticky. That's Step 3.
  - Nobody adapts: the AI still bluffs `probe:station` (6–14% of bets at
    `hard`). That's Step 5.
  - The `abc` yardstick's win rate is noise-level with no clear tier
    trend. It'll separate once postflop play differs by skill.

### After Step 3 (v0.52.0)

Seed 1, 3000 hands for each table (1500 for the test seats and the sweep).
AI averages:

| Tier | VPIP | PFR | AF | WTSD | Fold to bet | Size tell | `abc` bb/100 |
|---|---|---|---|---|---|---|---|
| medium | 46% | 13% | 0.7 | 54% | 48% | 0.59 | +5 |
| hard | 40% | 17% | 1.0 | 44% | 46% | 0.42 | **−92** |
| expert | 35% | 20% | 1.4 | 36% | 41% | 0.18 | **−105** |
| elite | 34% | 21% | 1.7 | 34% | 40% | 0.15 | **−73** |

- **A real ladder.** The plain `abc` player breaks even in the Back Room
  and loses at every tier above it. Across the skill sweep, showdowns fall
  steadily (58% → 34%) and the size tell fades (0.57 → 0.15).
  - WTSD is now within about 2 points of the Elite band (34% against
    25–32%) and 3 points of Expert's (36% against 25–33%).
  - The size tell sits inside the Back Room and Expert bands, just outside
    Elite's (0.15 against ≤ 0.15) and above Pub's (0.42 against ≤ 0.35).
- **In the browser:** the rebuilt AI plays real hands in the live game.
  Bets, calls, folds and checks all occur postflop, with no AI errors. In a
  direct in-page test, top set bets 93% of the time (the rest are trap
  checks), and a flush + straight draw semi-bluffs.
- **Bully (raises every hand, bets every street):**
  - Back Room crushes it (−445 bb/100): the stations call it down.
  - Pub loses to it (+151 for the bully): fit-or-fold amateurs, a real leak.
  - **Elite also loses to it (+70 for the bully).** Elite assumes every
    raiser has a normal range, so it over-folds to a player who raises
    everything. Only reading that player's habits fixes this (Step 5). A
    human who simply raises a lot must not be able to beat the High Roller
    room, so **Step 5 should come before Step 4**.
- **Station:** the AI still bluffs a player who never folds (6–13% of bets
  at `hard`). That's also Step 5.
- **Still short of the bands:** AF at the top (1.4–1.7 against 2.0–3.5)
  and Elite fold-to-bet (40% against 42–55%). Back Room fold-to-bet runs
  high (48%): fit-or-fold. Step 6 tunes these.

### After Step 5 (v0.53.0)

Seed 1, 3000 hands for each table; test seats and the sweep 1500. AI
averages (the Back Room row is identical to Step 3: it doesn't adapt):

| Tier | VPIP | PFR | AF | WTSD | Fold to bet | Size tell | `abc` bb/100 |
|---|---|---|---|---|---|---|---|
| medium | 46% | 13% | 0.7 | 54% | 48% | 0.59 | +5 |
| hard | 41% | 18% | 1.0 | 44% | 45% | 0.37 | −93 |
| expert | 36% | 20% | 1.4 | 40% | 39% | 0.19 | −125 |
| elite | 35% | 21% | 1.6 | 37% | 37% | 0.15 | −63 |

Test seats (bb/100 for the test player):

| | Back Room | Pub | Elite |
|---|---|---|---|
| `bully`, Step 3 | −445 | +151 | +70 |
| `bully`, now | −445 | **−414** | **−146** |

- **Against `probe:station` at Elite,** the adaptive characters stop
  bluffing it: river bluffs 0–1% for the Professor and Lucy. Tony
  (adapt 0.5) still fires some, and that's character. The Back Room keeps
  bluffing it (4–12% of its bets) because it never adapts.
- **The skill sweep keeps its ladder.** The `abc` player is between −69
  and +31 up to skill 40 (noise-level at 1500 hands), then loses at every
  point from 50 up (−78 to −133).
- **At Elite, AIs now read each other too,** so they call the table's
  bluffers down more. WTSD rose 34 → 37% and fold-to-bet fell 40 → 37%.
  Step 6 tunes this.
- **For Step 6:** in the Back Room the plain `abc` player (never bluffs,
  folds a lot) roughly breaks even across three seeds (+5, −39, −52). The
  plan wants a decent player to clearly beat the Back Room, so it should
  be a little softer.

### After Step 4 (v0.54.0)

Seed 1, 3000 hands for each table; test seats and the sweep 1500. AI
averages:

| Tier | VPIP | PFR | AF | WTSD | Fold to bet | Size tell | `abc` bb/100 |
|---|---|---|---|---|---|---|---|
| medium | 46% | 14% | 0.7 | 53% | 48% | 0.54 | −55 |
| hard | 40% | 17% | 1.1 | 38% | 50% | 0.38 | −81 |
| expert | 36% | 20% | 1.4 | 29% | 46% | 0.18 | −114 |
| elite | 35% | 21% | 1.7 | 24% | 45% | 0.16 | −99 |

- **The sweep from skill 10 to 100:** showdowns fall 60 → 24% and the size
  tell 0.53 → 0.15.
- **Bands:**
  - Expert's WTSD and fold-to-bet are now inside their bands.
  - Elite's fold-to-bet is inside its band; its WTSD (24%) is just under
    its band (25–32%).
  - Pub's WTSD (38%) is at the top of its band; its fold-to-bet (50%) is at
    the top of its band.
- **Test seats** (bb/100 for the test player): `bully` −319 / −243 / −83
  at Back Room / Pub / Elite; `station` −1146 / −1443 / −1599. At Elite,
  the Professor and Lucy river-bluff the station 0–1%.
- **Back Room got harder.** Its small reading skill (0.2) now narrows a
  little too, and the plain `abc` player lost −55 there (+5 before).
  Softening the Back Room is the first job of Step 6.
- **Checked in a real browser:** the worker's narrowed equity matches Node
  (top pair against a raise-bet-bet line: 0.13 in the page, 0.11 in Node,
  against 0.81 raw). The live game's hand log records each street's
  checks, bets and calls.

Re-run and record here after every step.
