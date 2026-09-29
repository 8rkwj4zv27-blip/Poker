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
(Owner, 29 Sep 2026: HELP defaults to **ADVICE**; the key reads **P.I.P.**)
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

## Step 2 · Judge 1: before the flop (built 29 Sep 2026, v0.55.0)

**The judge** (`CoachBrain.judgePreflop`, run on every recorded decision):
the yardstick is the game's own sound-player ranges, measured in its
starting-hand ranking (`preflopPercentile`), copied into the brain:

- **Nobody in**: raise the top X% for your seat, by how many are left to
  act (`OPEN_RANGE_BY_BEHIND`: about 17% under the gun six-handed, 28% in
  the cutoff, 44% on the button, 80% heads-up), fold the rest. Limping is
  a mistake (raise or fold); the small blind topping up is fine unless
  it's junk. A raise over 5 big blinds is noted; all in for 25+ big
  blinds, first in, is a clear mistake bar aces and kings.
- **Limpers in front**: raise them with about 70% of the opening range;
  limping along is fine with small pairs, suited connectors or a late
  seat.
- **The big blind, nobody raised**: check is right; folding when it's
  free is always a clear mistake; raise the limpers with the top 12-15%.
- **Facing a raise or re-raise**: your chance of winning against the
  hands that raise usually means (the raiser's seat, a big size, their
  raising habit from the table's public notebook; re-raises by
  `RERAISE_RANGE`), discounted for playing out of position and for weak
  hands, against the price (pot odds, plus a margin for players still to
  act and for cold-calling). Re-raise with 60%+.
- **Short (10 big blinds or less, nobody raised)**: shove or fold, by
  `PUSH_RANGE_BY_BEHIND`, with a wide close band (those ranges are a
  shade tight of the push/fold charts). Short and facing a raise: shove
  or fold, not call.
- **Small pairs** are rated like the charts rate them (top 15-20%), not
  by the equity ranking, which undervalues set-mining hands.
- **Confidence**: CLEAR only well outside a range; LEANS at the edges;
  CLOSE at the edge itself, called close. The quoted numbers always agree
  with the verdict (the position discount is folded into the "needed").

**What he says** (`coach-talk.js` routing, lines in `js/coach-lines.js`,
310 lines):

- **A word right after you act**: a clear mistake at notch 1 ("Too loose
  from there."), a notable good play at 2 ("Good fold.") no more than
  once every 4 hands (2 at IN YOUR EAR), a lean at 3. One a hand; it
  replaces the "your turn" line.
- **The reason after the hand** (notch 2; close calls at 4), for the
  decision that most needs it, with the numbers. Led by "You won it, but
  that's not the point." or "You lost, but the decision was right." when
  the result would mislead.
- **The lesson** (starting hands, position, raise or fold, calling
  raises, big-blind defence, short stacks, three-bets, the basics) the
  first time it comes up this session.
- **The same mistake again soon after** (within 3 hands if clear, 6 if a
  lean): a short reminder by lesson ("Another limp. Raise or fold."), not
  the whole speech.
- **Your cards with your seat** at IN YOUR EAR ("Jack-Ten suited on the
  button. Plenty good enough from this seat.").

**Proof**: `validation/coach-brain-checks.js`, now 35 checks: known spots
(seven-deuce raised under the gun, Ace-King folded, queens limped, King-
Nine calling an early raise, the big blind defending nine-seven suited,
Ace-Nine shoved with 8 big blinds...), the library (flat, clean, fits the
bubble, only real blanks, 250+ lines), and 5,000 random decisions (never
a clear mistake for the best move, never a mistake for folding junk or
for raising aces, the numbers agree with the verdict, every verdict has
its lines, every lesson has its lesson and reminder lines). In the real
game in an emulated iPhone over 12+ hands: words, reasons, leads,
lessons and reminders, no errors.

**P.I.P. Brain Lab** (`coach-brain-lab.html`, `js/coach-brain-lab.js`,
host `js/coach-brain-lab-host.js`): TRY IT (19 set spots, each explained
in full), HIS VERDICTS (every decision you've played, with his verdict,
confidence, the better move and the numbers; tap to hear it), TALK, KEY
(P.I.P. · TV + PIP · the v0.54 TV).
Link: https://claude.ai/artifact/93fSUyPJJemnRhGkq7yXyJ

**Next: step 3, after the flop.**

## Step 4, brought forward: advice before you act, and tapping him (v0.55.1)

Owner (29 Sep 2026): step 2 only spoke after a move, "so it's not really
helping me out". Option A: advice before you act, for the preflop now
(after-the-flop advice comes with step 3's judge); and tap his screen for
an immediate read of the game.

- **`CoachBrain.advisePreflop(spot)`**: the judge run on every move you
  could make (fold or check, call, raise to his size, all in). His move is
  the judge's best; how sure he is comes from the next-best move (CLEAR:
  the only good one; LEANS: another is defensible; CLOSE: another is as
  good). Sizes: 2.5 big blinds to open, plus one per limper; a three-bet 3x
  in position, 3.8x from the blinds; all in when short.
- **The HELP dial** (Settings → P.I.P. help, `settings.coachHelp`, default
  **ADVICE**): WATCH (nothing before you act) · HINTS (what to think about:
  "It's 60 to call. Does King-Nine offsuit win often enough to pay that?") ·
  ADVICE (the move and why; "It's close. I'd fold, but call is fine too.") ·
  TELL ME (always the move, with numbers and size). Unprompted at TIPS on
  the big decisions (a raise to face, short, a premium hand, anything not
  clear-cut) and at IN YOUR EAR on every decision bar folding junk. It
  replaces the "your turn" price line; if you follow his advice he doesn't
  then praise you for it.
- **Tap his screen** (`#coach-station`): on your turn before the flop, his
  advice in full whatever the dial; after the flop, what you have, your
  draw and your chance of hitting it (exact, by the river or on it), the
  price or the next card against the price, and the board's danger; not
  your turn, the same without the price; folded, "watch how they bet";
  between hands, the last hand's lesson. Tap again within 12 seconds: a
  layer deeper (the lesson, or pot odds, outs, equity, kicker, position
  explained). Facts only after the flop until step 3's judge.
- **Tests**: 38 checks (advice on familiar spots with sizes; the read's
  outs and chance; 5,000 random decisions: advice is always a move you
  have, never one the judge calls a clear mistake, always has lines).
  Played in the real game in an emulated iPhone: advice, a word when it
  was ignored, taps and a second tap, no errors.
- The old Coach readout stays until the owner says to retire it (his tap
  now covers its numbers before the flop and the price after it).

## Tidy-up (v0.55.2, 29 Sep 2026)

- **The old Coach panel is gone.** It was off by default with no switch
  left in Settings, so nobody could see it. Its markup and code are
  removed; `updateCoach()` stays as the "your turn" signal P.I.P. listens
  for (it refreshes the hand CRT). Its unused styles are left in place
  because they share rules with Hand Review. `settings.coach` is left in
  saved settings, untouched.
- **Hand Review stays** (Settings → Hand review, off by default); P.I.P.
  takes over its "who won and why" later, then it retires (owner to
  confirm).
- **His key**: the tiny P.I.P. letters couldn't be read. Now HIS FACE
  (default suggestion), PIP IN BIG LETTERS, or the v0.54 TV, in the Brain
  Lab's KEY tab.
