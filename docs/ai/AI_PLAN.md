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

### Step 3: decisions as frequencies, plus a hand plan
- Each spot produces fold/call/raise probabilities and samples from them
  (the "probability triple"), replacing thresholds plus random noise.
- On its first aggressive action the AI picks a **line**: value, barrel,
  one-and-done, trap, semi-bluff or float. It keeps the line across
  streets and changes it only when a card changes the story.
- This brings c-bets as the preflop raiser, check-raises and slow-plays,
  and barrels on scare cards.
- Sizing is chosen from the board and the line, not from hand strength.
  All-ins stop meaning "only the nuts".
- Think time stops leaking the action.

### Step 4: range narrowing
- Each AI keeps a weighted range for every opponent and re-weights it after
  each action. Equity is computed against those ranges (sampled in the
  worker). Reading skill scales with tier.

### Step 5: reading the human
- Track the human's tendencies over an event: VPIP/PFR, fold to c-bet, fold
  to river bet, bluffs shown down, how often they barrel. Each AI adapts at
  its own speed: fast for the Professor, never for the Station.
- Real tilt: a big loss changes decisions for a few hands, in the style of
  the character.

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

Re-run and record here after every step.
