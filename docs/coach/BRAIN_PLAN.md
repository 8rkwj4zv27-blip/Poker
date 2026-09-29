# P.I.P.'s brain — plan

Written 29 Sep 2026, after the owner's answers on the handover
(`docs/coach/BRAIN_HANDOVER.md`). The handover's rules still stand: flat
voice, facts exact, verdicts with confidence, judge the decision not the
result, he only knows what you know, proved by tests. This file adds what
the owner asked for on top, and the order it gets built in.

## The owner's answers (29 Sep 2026)

1. **Directness is the player's choice**: a second dial next to the talk
   slider sets how much direct help he gives (below).
2. **Mistakes: both.** A short word in the moment, the reasons in the
   debrief after the hand.
3. **Name: P.I.P.** (Poker Intelligence Personality). "PIP" in lines; the
   dotted form on the COACH key's label and in Settings if it fits.
4. **The old Coach readout retires**, or its numbers are folded into him.
   Plan: his tap answer (below) carries the equity and the price, so the
   readout goes when step 4 lands. The owner confirms before it's removed.
5. **Tapping him does something**: contextual help (below).
6. **In depth, and he grows with you**: start basic, move on to the
   advanced systems the longer you play and the better you get, "how I
   can start beating players". Lots of lines, so he reads like a person
   watching, not a loop.

## What real coaches teach, and in what order

He teaches the way most poker courses and coaches take a new player
through no-limit hold'em. They start with a tight-aggressive base
("play fewer hands, and play them hard"), then add the maths, then
reading people, then exploiting them. Every stage is a set of lessons he
watches for. You move up a stage by playing enough hands at the current
one *and* showing you've got it (the habit he's watching for has
settled). He never announces "LEVEL UP" like a game. He says something
plain: "You've stopped calling raises with weak hands. Time to talk about
position properly."

**Stage 1 · The basics** (from the first hand)
- Starting hands: most hands are folds. The top ones, and why suited and
  connected hands matter.
- Position: acting last is an advantage. Play fewer hands early and more
  on the button.
- Raise or fold, don't limp. Why a raise wins pots a call can't.
- Don't call raises with weak hands ("calling is the weakest move").
- What the terms mean: blinds, button, pot, check, call, raise, all in,
  showdown, kicker.

**Stage 2 · The price** (the maths, kept simple)
- Pot odds: what a call costs against what it can win, as a percentage.
- Outs, and the rule of 2 and 4 for your chance of hitting.
- Equity: how often your hand wins from here.
- Chasing draws at a bad price. When a draw is worth the call.
- Top pair and kickers; what "the nuts" means; paired and suited boards.

**Stage 3 · Betting with a reason**
- Value bets: bet your strong hands so worse hands pay you. Don't slow
  play by default.
- Bet sizing: about half to three-quarters of the pot; bigger on wet
  boards, smaller on dry ones.
- The continuation bet: the preflop raiser betting the flop, and when not
  to (several players, a board that hits them).
- Protection: charging draws when you're ahead on a wet board.
- Pot control: keep the pot small with a medium hand.

**Stage 4 · Reading players**
- Their habits from what he's seen (the table's public notebook): how
  many hands they play, how often they raise, how often they fold to a
  bet.
- The four types: tight or loose, passive or aggressive, in plain words
  ("Mavis calls almost everything. Don't bluff her. Bet your good hands
  bigger.").
- What a raise from each type usually means.
- Big river bets from passive players are almost never bluffs.

**Stage 5 · Beating them** (the advanced systems)
- Thinking in ranges: "what hands would they do this with?", not "what
  hand have they got?".
- Bluffing well: semi-bluffs with draws, bluffing one player rather than
  three, boards that suit your story, fold equity.
- Stack depth: short stacks and shove-or-fold (below about 12 big
  blinds), the stack-to-pot ratio and being pot committed.
- Three-betting (re-raising) for value and as a bluff; stealing the
  blinds from late position; defending the big blind.
- Exploiting each type: bluff the tight ones, value bet the callers, trap
  the maniacs.
- Tournament pressure: blinds rising, the bubble, when survival matters.

He still reacts to anything that comes up at any stage (a clear mistake
is a mistake). The stage decides **what he explains in depth**, which
terms he assumes you know, and which habits he's tracking. A stage-1
player gets "You need about 25% to call. You've got about 35%. Call."
A stage-3 player gets "Price is fine. But you're ahead of his draws, so a
raise charges them."

## The two dials

**TALK** (as signed off): 1 COMMENTS · 2 DEBRIEF · 3 TIPS · 4 IN YOUR EAR.
How often he speaks.

**HELP** (new; the owner's answer 1): how directly he advises before you
act.
1. **WATCH**: no advice before you act. He teaches afterwards only.
2. **HINTS**: he points at what matters, not the move ("Look at the
   price before you call this.").
3. **ADVICE** (suggested default): he names the move when it's CLEAR,
   and leans when it's close ("I'd fold. It's close, though.").
4. **TELL ME**: he always names the move, with the numbers.

A HELP setting of 1 at TALK 4 is a commentator who explains. HELP 4 at
TALK 3 is a quiet coach who tells you the move on the big decisions.

## Mistakes and good plays: in the moment, and after

- **In the moment**, right after you act: a few words, only when the
  verdict is CLEAR, and not every time (a budget per few hands). "That's
  a lot to call with that." / "Good fold." / "Nice raise."
- **In the debrief**, once the pot's paid (TALK 2+): the reason, with the
  numbers, and the lesson it belongs to. It judges the decision, not the
  result: "You lost, but calling was right. You needed 25% and had 36%."
- He never talks over the opponents' table talk (when it comes). One
  speaker at a time.

## Tapping him

- **On your turn**: his read of the spot at your stage. The price, your
  chance of winning, and (from HELP 2 up) what he'd do and why. This
  replaces the old Coach readout.
- **Tap again**: the next layer: "why", the term explained, or what the
  opponent's bet usually means.
- **Between turns**: the last thing he'd have liked to say (a line he
  dropped for being stale), or a tip from your current stage, or the
  lesson from the last hand.
- **After a hand**: its debrief, if he hadn't given it.
- Tapping doesn't change the game. Tapping the bubble still closes it.

## Accuracy: how the judges decide (build steps 2-4)

- **Preflop** (judge 1): the starting-hand ranking (`preflopPercentile`),
  your position (seats left to act), what's happened before you
  (unopened, limped, raised, re-raised), stack depth. Measured against
  standard open, call and re-raise ranges by seat (the AI's own
  `PREFLOP_SKILL` / open and push ranges as the yardstick), and push/fold
  ranges when short. CLEAR only well outside the range; the edges are
  LEANS or CLOSE.
- **After the flop** (judge 2): your chance of winning against the hands
  the opponents' public betting points to (`estimateEquityVsRanges`, the
  same narrowing the AI uses), against the price (pot odds), with draws,
  outs, the board's dangers and the stack-to-pot ratio. CLEAR when the
  margin is big; CLOSE is said as close.
- **Proof**: `validation/coach-brain-checks.js` (hand-built spots with
  known answers) plus a silent run of thousands of hands through the
  AI harness with a stand-in human, asserting nothing nonsensical (no
  CLEAR fold of the nuts, odds within bounds, every spot recorded).

## The dialogue library

Hand-written lines per situation and stage, blanks filled by the game,
several wordings each, no repeats within a stretch. The owner wants a lot
of them: now roughly **1,000+ in the end**, grown step by step:

| Step | Lines (about) |
| --- | --- |
| 2 Preflop judge, stage 1–2 lessons | 250 |
| 3 After the flop | 250 |
| 4 Advice before you act, tap answers | 150 |
| 5 Teaching moments, glossary | 150 |
| 6 Memory, habits, progress | 100 |
| 7 Stages 3–5 and variety | 200+ |

The owner reads and reacts to lines in the voice lab (TRY IT), never as a
list in chat.

## Build order

1. **Watching** (this step): a record of every decision you make and how
   each hand ended, public facts and your own cards only. Nothing new is
   said yet. Checked by tests.
2. **Judge 1: preflop**, stage 1 lessons, the in-the-moment word and the
   debrief for those decisions. The first version the owner plays with a
   real brain. Delivered through the voice lab first.
3. **Judge 2: after the flop**, stage 2 lessons.
4. **Advice before you act**, the HELP dial, tapping him. The old Coach
   readout retires.
5. **Teaching moments**: the first time a term comes up he explains it;
   a glossary on tap.
6. **Memory and stages**: habits across sessions, the stage you're at,
   progress, a session report. A new localStorage key (`pipCoach`);
   existing settings and lifetime stats untouched.
7. **Stages 3–5 and dialogue expansion.**

Each step: plan, build, tests, a voice lab link for the owner, a release.

## Step 1 · Watching (built 29 Sep 2026)

`js/coach-brain.js` (`CoachBrain`): no drawing, no sound, no game
changes. Pure functions over a game state, so they run in Node for tests.

- `CoachBrain.spot(g, me)`: the decision you face, read only from what
  you can see: street, your cards, the board, your seat (BTN, SB, BB,
  UTG, ... from the dealer), how many players act after you, players
  still in, stacks in big blinds (yours and the effective stack), the
  pot, the price, pot odds, the minimum raise, whether you may raise,
  the situation before you (unopened, limped, raised, re-raised, and for
  later streets checked-to or facing a bet), who raised preflop, raises
  this street, this hand's public actions, the stack-to-pot ratio, the
  starting-hand ranking, and after the flop your made hand, draws, outs
  and board dangers.
- `CoachBrain.choice(spot, decision, after)`: what you did, as fold,
  check, call, bet, raise or all in, with the amount and its size against
  the pot.
- The hand record: `CoachBrain.hand` (hand number, seat, starting stack,
  every decision) and, once the pot's paid, how it ended (won or lost and
  by how much, showdown or not, and the cards the opponents showed, only
  if they were shown). The last 50 hands in `CoachBrain.history`, for
  this session only (memory, step 6, saves it).
- Events for later steps: `coachdecision` and `coachhand` on
  `document`.
- **No hand goes missing.** Found in the real game: after you fold, the
  game fast-forwards the rest of the hand, and it can finish between two
  of the watcher's looks (every 200ms), so the end was never seen (his
  talk has always had this gap). The brain now keeps a running picture of
  the hand (`observe`, every look), and if the next deal comes first it
  closes the last hand from that picture (`closeMissed`), with the result
  worked out exactly from your stack at the new deal. Checked in an
  emulated iPhone over 11 straight hands: every hand recorded, seats and
  results right, no console errors from the Coach.
- `coach-talk.js` feeds it: the decision is read **before** your action
  is applied (the price you faced), the choice after; the hand's start
  and end come from the same state watcher he already uses.
- Guard rails: it never reads an opponent's cards except at a showdown
  they reached, never reads the deck, and never writes to the game
  (`validation/pattern-book-checks.js` covers it with his other files).
