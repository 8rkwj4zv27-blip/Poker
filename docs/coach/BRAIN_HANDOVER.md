# The Coach's brain — handover

For a fresh session building the Coach's brain. Written 29 Sep 2026, the
day the Coach went live without one (v0.54.0, PR #44). Read this first,
then `docs/coach/COACH_PLAN.md` for the full history, `docs/CODEMAP.md`
for where things live, and `CLAUDE.md` for the house rules.

## Where things stand

The Coach is **in the game** with his look, rig and voice signed off, and
**placeholder lines**. The owner switches him on with the little-TV
**COACH key** beside ⚙ on the dashboard (`settings.coachBot`, off by
default). Settings → **Coach talk** is the talk slider (`settings.coachTalk`,
'1'-'4', default '4').

- `js/coach-set.js` + `css/coach-set.css`: his pixel TV, the lift on and
  off, the aux lead, the boot, his face. Public API: `CoachSet.power(on)`,
  `CoachSet.setMood(m)` (calm, pleased, impressed, surprised, wince,
  unlucky, thinking), `CoachSet.mouth(open)`, `CoachSet.look(target)`
  ('you', 'pot', 'player', 'ahead'), `CoachSet.on`, `CoachSet.busy`.
  **Don't redesign any of this**; it's the owner's signed-off order
  (Pattern Book: Coach).
- `js/coach-talk.js` + `css/coach-talk.css`: his bubble, voice, typing,
  and today's placeholder brain. This is where the brain plugs in.
  - `LINES`: `{ moment: [[notch, mood, text], ...] }`. `{slots}` are filled
    from a context object. `notch` is the lowest talk-slider setting a line
    plays at.
  - `say(moment, ctx)`: picks a line (never the same twice in a row),
    shows it. One line at a time; a waiting line gives way to a more
    important one (lower notch); lines older than 4.5s are dropped.
  - Hears the game by wrapping `applyAction` and `updateCoach`, and by
    watching `game.handNumber` / `game.phase` (the deal; the end of a hand
    once the pot's paid). **Don't wrap `startNewHand`**: other parts of
    the table swap it in and out and a wrapper is lost. `finishHand`
    wrapping also proved unreliable; the state watcher is what works.
  - Numbers and card names are rendered in the screen font automatically
    (`runs()`), so write them plainly in lines.
- Today's moments: dealt (by exact starting-hand rank), opponent raise /
  big bet / all in, your turn (the price and pot odds, or a free check),
  you fold / call / raise / all in, win big / small, everyone folds, lose
  at showdown / big, someone out, you out. He has **no judgement yet**:
  only reactions and exact facts.
- `coach-voice-lab.html` drives the same files: its TRY IT tab fires any
  moment, SAY says something for the table now. Use it (or a new lab) to
  let the owner hear new lines on their phone.

## What the owner wants from the brain

In the owner's words: a coach who "actually watches me play and advises
me", "explaining poker to me like I don't really know what the terms for
playing really mean", teaching "when to push, what went right and what
went wrong, how I can improve", "properly in depth with hundreds of lines
of dialogue". The owner says they don't really know poker yet; the Coach
should make them see themselves improve.

### His voice (agreed, firm)

- **Flat.** Plain, clear, informative, with the occasional short
  reaction. Not a big personality. The owner rejected a gravelly mentor
  voice outright.
- **Never a nickname for the player** ("kid" etc. were rejected), no
  catchphrases, no winking, no poker puns.
- Explains terms as he uses them, as if to someone who doesn't know them
  (pot odds, position, outs, equity, bluff catcher, value bet, draw...).
- He speaks **clean** (the opponents may swear later; he doesn't).
- Examples of the right tone:
  - "Pocket eights. Decent, but the player to your left raised, so you're
    likely behind a bigger pair or two high cards."
  - "Good call. You needed about 25% to make that pay and your flush draw
    was around 35%."
  - "Unlucky. You were ahead until the river."
  - "That bet was too small. With top pair, a bigger bet gets more from
    the hands that call you."

### The talk slider (the four notches)

1. **Comments**: reactions only ("Unlucky.", "Great bluff.", "Bad move.").
2. **Debrief**: plus what went right or wrong after a hand, and why.
3. **Tips**: plus advice before the big decisions.
4. **In your ear**: everything: reactions to the deal, reading opponents'
   bets, advice on every decision.

Every line carries the lowest notch it plays at. Table talk stays
sparse at the low notches.

### Accuracy (the owner's main requirement)

1. **Facts are exact**: hand names, the price of a call, pot odds, outs
   and the chance of hitting, from the game's own maths.
2. **Verdicts carry confidence.** "Bad move" only when it clearly was;
   close spots are called close ("Coin flip, that one. I'd have folded,
   but it's close.").
3. **Judge the decision, not the result.** A good play that loses is
   still a good play, and he says so.
4. **He only knows what you know.** Never an opponent's hidden cards
   until they're shown at showdown.
5. **Proved, not hoped**: a test suite of hand-built spots with known
   answers, plus a silent run over thousands of simulated hands
   (`validation/tools/ai-harness.js`, `validation/tools/ai-sim.js`) to catch
   nonsense. Poker rules and evaluation must stay correct (CLAUDE.md).

### The dialogue engine (agreed design)

- Hand-written lines per situation, **not** sentences glued from loose
  words. Blanks the game fills (cards, opponent name, pot, price, odds,
  outs, percentages). Two or three wordings per situation (the flat voice
  needs fewer than a big personality would). No repeats within a stretch.
- One speaker at a time. He must not talk over the opponents once their
  table talk arrives (see "Later" below).
- No live AI model: offline, free, no new dependency. (An "ask the
  coach" button with a model was mentioned only as a far-future idea.)
- Target: roughly **600-800 lines** in the end, grown over the steps.

## Build order for the brain (from the plan, steps 6-9)

Build each step so the owner can play it; plan substantial changes
before implementing (CLAUDE.md).

1. **Watching**: a decision record for every human action: cards,
   board, position (`seatsAfter`), stack depth in big blinds, the price,
   the pot, players left, what the opponents did this hand (public:
   `g.handLog`, `g.streetRaises`, `g.pfAggressorId`), what the player
   chose, and later how the hand ended.
2. **Judge 1: which hands to play, from which seat** (preflop). The most
   important thing for a beginner and the easiest to get exactly right.
   Unlocks notch 2 (debrief) for those decisions. Typical leaks: playing
   too many hands early in position, limping, calling raises with weak
   hands, not raising strong hands.
3. **Judge 2: after the flop.** Calling at the right price (pot odds
   against equity), chasing draws at a bad price, betting strong hands
   (value) rather than checking, bet sizing, big river bets and bluff
   catchers, bluffing into several players.
4. **Advice before you act** (notches 3-4). This takes over the old Coach
   readout (see "Retire" below).
5. **Teaching moments**: the first time a term comes up, he explains it
   in plain English; a glossary he can come back to.
6. **Memory**: habits across sessions ("that's the fourth time you've
   chased a draw at a bad price"; "you've stopped doing X, I noticed"), a
   session report, and a sense of improvement. **A new localStorage key**;
   existing settings and lifetime statistics must not be touched
   (CLAUDE.md).
7. **Dialogue expansion** to the full library, with a teaching order:
   starting hands, then position, then the price of a call, then bet
   sizing, then reading opponents.

## Maths already in the game (reuse it)

All in `js/01-poker-math.js` unless noted; the AI rebuild (v0.53.0)
already uses these.

- `preflopPercentile(hole)`: 0 = AA, ~1 = the worst; "top X%".
- `describeHole`, `describeMade`, `describePlayerHand`: hand names.
- `estimateEquityVsRanges(hole, board, ranges, iters)`,
  `rangeRelStrength`, `EquityService.get(...)` (runs in the worker):
  equity against ranges.
- `classifyPostflop(hole, board)`: made hand, draws, board texture.
- `detectDraws`, `computeOuts`, `boardThreats`: outs and board dangers.
- `js/03-opponents.js`: `seatsAfter` (position from the button), the
  public notebook of habits (`g.reads`, `aiReadOf`), range narrowing from
  public betting (`narrowWeight`, `g.handLog`), `PREFLOP_SKILL` / open and
  push ranges (a good yardstick for "should this hand be played from
  here"). Read `docs/ai/AI_PLAN.md` before leaning on the AI's internals.
- `js/06-presentation.js` `updateCoach()` (the old Coach readout) and
  `js/07-ui-wiring.js` `buildReview()` (the old Hand Review lessons):
  prior art for equity-vs-price advice and board lessons.

## Retire (once he covers them)

The old **Coach** switch (the equity/pot-odds readout, `settings.coach`)
and **Hand Review** (`settings.review`) should be retired once the new
Coach covers what they do. Ask the owner before removing them.

## Later, not now

- **The opponents' dialogue** (the Speech Lab, `speech-lab.html` on
  branch `claude/tender-dijkstra-zso8dm`, unmerged): the owner wants the
  Coach finished first. When it comes, it shares the Coach's bubble and
  blip system; one speaker at a time on the lower felt; the Coach can
  follow an opponent's line with a lesson ("He's lost three in a row.
  He'll start calling with worse hands now.").
- **A name** for the Coach: never decided.

## Working with the owner (how every round has gone)

- Visual or dialogue changes go through a **phone-first lab** delivered as
  a **private Artifact link** (CLAUDE.md, "Visual labs"): stage with
  `node validation/tools/lab-bundle.js <lab>.html <scratchpad>/bundle-<lab>`,
  publish, give the link, republish to the same link after changes. Every
  row's first option is the suggestion; COPY MY PICKS lets the owner paste
  their choices back.
- For dialogue, the owner reads drafts and reacts to tone; show real
  lines in the voice lab rather than lists in chat.
- The owner answers quickly and specifically; when they give picks, lock
  them in as the defaults and record them in `docs/coach/COACH_PLAN.md`.
- Keep him presentation-only: `validation/pattern-book-checks.js` (the
  Coach check) fails if his files change game state or read an
  opponent's cards; update that check when his files grow.
- Release: bump `BUILD_VERSION` (`js/02-support-systems.js`) and
  `CACHE_NAME` (`sw.js`) together, add new files to both `index.html` and
  `sw.js`, run the fast suites, open a PR; the owner's phone updates from
  `main`.
- Testing tips: `validation/tools/touch-harness.js` (Playwright, emulated
  iPhone, real touch); `DEV_MODE=true; FAST_DEV=true` in the page speeds
  the AI up for playing many hands; `window.__said`-style listeners on
  the `coachtalk` event (dispatched by `say()`) show what he tried to
  say.

## Known issue (not the Coach's)

A fresh install's first Quick Deal logs `TypeError ... reading 'build'`
from `js/coin-bank.js` (`View`, via `js/coin-table.js ensureView`). It
predates the Coach; suggested as its own task.
