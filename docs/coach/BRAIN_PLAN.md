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

## Step 3a · After the flop: calling and folding (v0.56.0, 29 Sep 2026)

Facing a bet after the flop (`CoachBrain.judgePostflop`, and `advise` for
the same spots):

- **Their likely hands**, from public facts only, as the AI reads them:
  what each opponent did before the flop (the raiser: the top X% for their
  seat; called a raise: 20%, 45% from the big blind; called a re-raise: 8%;
  limped: 45%; the big blind in a limped pot: anything), widened or
  narrowed by their habits in the table's notebook, then narrowed by every
  bet, raise, call and check since the flop (`narrowWeight`), with their
  bluffing read from how often they bet and bluffs seen at showdowns.
- **Your chance** against those hands (`estimateEquityVsRanges`, 1,500
  samples, once per decision), used a little less before the river out of
  position or with nothing, against the **price** (pot odds, plus a margin
  with players still to act, less a little for a strong draw with deep
  stacks: implied odds).
- **Raising for value needs two pair or better** (and 70% against one
  player, 55% against more): a raise gets called by better hands, so top
  pair and overpairs call (raising them is fine, but close, as
  protection). A strong draw may raise against one player as a
  semi-bluff (fine, close).
- **Verdict tags**: `post.fold.strong` / `good` / `close` / `draw` (had
  the price to draw) / `priced`; `post.call.value` / `good` /
  `draw.good` / `close` / `draw.bad` (chasing at the wrong price) /
  `weak`; `post.raise.value` / `protect` / `semi` / `close` / `loose`.
  Lessons: pot odds, drawing odds, river bets, hand strength, raising for
  value, semi-bluffs (each with its reminders).
- **Advice** at your turn when you face a bet (3x the bet, plus one per
  caller, to the big blind; all in if that's most of your stack); the tap
  read adds it in place of the price. Checked to you or first to act
  (betting) is **step 3b**.
- **Less nagging**: the same in-the-moment word isn't repeated within 2
  hands (4 for a lean).
- **Proof**: 44 checks, including known spots (a flush draw at half pot:
  call; a gutshot against a pot bet: fold; nothing: fold; top pair: call;
  a set: raise; bottom pair to a pot-sized river bet: fold) and 1,500
  random spots after the flop (advice you can take and never a clear
  mistake by the judge, the numbers agree with every verdict, folding a
  near-certain winner is always a mistake, lines for everything). About
  514 lines in the library.
- **Lab**: 8 after-the-flop spots in TRY IT.

## Round after the owner played (v0.57.0, 29 Sep 2026)

The owner played Ace-Two on A-5-2-6-3, checked to on the river: P.I.P.
only said "Nobody's bet. You can check." After winning, he said "They had
it that time", then talked about a close raise before the flop. The
owner: timing is key (never before the cards are shown, the debrief
after the winner's revealed but before COLLECT); facts aren't advice
("Tony limped and has checked every street" tells you nothing); nothing
on bluffing; too much poker jargon ("on the edge from the cutoff"). But
keep the terms: learn them as you play longer.

- **Timing.** His line about your cards waits until they're turned over
  for you (`game._humanCardsVisible`). The result and debrief come the
  moment the winner is shown and the COLLECT key is up (`#console-flip`),
  before the pot is paid: `CoachBrain.settle` works your result out from
  the game's own pot split (`computePots`, side pots included) and the
  hands that were shown. (The bug: he read your stack 5 seconds after the
  showdown, before COLLECT paid it, and thought you'd lost.) Talk left
  over from the last hand waits while new cards are face down. Someone
  going out is said at the next deal, when it's certain.
- **Step 3b: checked to you, bet or check** (`judgeBet`, and `advise`).
  Strong hands bet for value (checking one on the river is a clear
  mistake: "You won 108, but you could have won more"); middling hands
  check (keep the pot small); a strong draw bets against one player (a
  semi-bluff); nothing checks, or **bluffs** when it makes sense: one
  player (never several), not someone who calls everything, and when
  they're likely to fold often enough to pay for it (a bet B into a pot
  P needs them to fold B/(P+B) of the time; how often they fold comes
  from their notebook habit and checking this hand). A bluff is never
  called clear-cut: the fold chance is an estimate. Sizes: half the pot on
  quiet boards, two-thirds on wet ones and the river; a bluff the same.
- **What their betting says** (`stories`): only checked = usually weak;
  betting = usually a real hand; calling = a middling hand or a draw;
  plus habits from the notebook (calls everything, has bluffed, plays
  lots, plays few). It leads his advice and his tap read: "They've all
  checked. Nobody's shown any strength. You're well ahead. Bet about 50.
  Worse hands will call."
- **Plain English, with terms learned as you go.** Every line was
  rewritten: what's happening, what it means, what to do. A poker word is
  written `{t:term}` and reads in plain words ("just calling the big
  blind") until the lesson that teaches it has been said ("That's called
  limping."), then as the word. Seats likewise ("one seat before the
  dealer button" → "the cutoff" after the position lesson). Hands read as
  "a strong starting hand"; ranges as "about 1 hand in 4". What he's
  taught is remembered under a new storage key, `pip.coach` (settings and
  lifetime stats untouched): the start of step 6's memory. A check fails
  on any poker jargon outside a lesson.
- **Debrief**: the decision that mattered most, weighted to later streets
  and bigger pots; close calls read "Fine. ...".
- **Tap him**: what you have, what their betting says, and (your turn)
  what to do, including when to bluff.
- **Proof**: 51 checks, adding step 3b's spots, the stories, the terms
  (every term has plain words and a lesson), no jargon outside lessons,
  800 random checked-to spots (bluffs never clear-cut), and settling a
  showdown before the pot's paid. Played in the real game at normal
  speed, pressing COLLECT by hand: cards first, then his line; the
  debrief with COLLECT waiting; results right every hand.
- **Lab**: 8 checked-to spots in TRY IT (the owner's river hand among them).

## Refinements after the owner played v0.57.0 (v0.57.1, 29 Sep 2026)

Owner: with pocket aces, P.I.P. said raise; everyone folded; no follow-up.
Tapping him on the award screen repeated "Pocket Aces... one of the very
best starting hands", then "going last is an advantage", then the aces
again. His verdict often came at the start of the next hand. Lines
repeat. ("Ask P.I.P." question keys: parked for now.)

- **The bug**: when everyone folds straight away, the game goes to the
  award screen with the phase still 'preflop'. He waited for 'showdown' or
  'foldwin', so thought the hand was still on: no verdict, and taps read
  your cards back to you. The end of a hand is now the award screen
  itself (`#console-flip`), whatever the phase.
- **On time**: his verdict is said the moment the result is shown (in
  place of the plain result line, which is only said when he has nothing
  better), and never carried into the next hand: if you press COLLECT
  first, a tap between hands brings it back.
- **When everyone folds to you**: its own words
  (`<tag>.why.foldwin`): "Everyone folded. That happens with a great
  hand, and raising Pocket Aces was still right." And with a great hand,
  a tip on winning more (`tip.bigHands`): raise the same amount as usual
  so they can't tell; against players who fold a lot, a slightly smaller
  raise keeps them in; don't just call to trick them.
- **Taps step forward, never loop**: each tap says the next thing for the
  moment (your turn: his read, the lesson, a tip; the result: the
  verdict, the lesson, a tip, a tip on big hands), skipping anything he's
  already said this hand, then "That's all I've got on this one" until
  the moment changes. An all in still running out: "Let's see how the
  cards land."
- **Less repetition**: every wording for a moment is used before any
  comes round again (this session); more wordings for the things he says
  most; the plain "Called." / "Folded." only now and then.
- A tip for every lesson (`tip.<lesson>`), hand summaries for taps when
  there's no verdict (`sum.*`). "Roxy bet a small bet" → "Roxy made a
  small bet".
- Checked in the real game: an all in everyone folded to before the flop
  (phase still 'preflop') gets its verdict on the award screen; four taps
  step verdict → lesson → tip → "that's everything".

## Tidy-ups from play, v0.57.4 (29 Sep 2026)

The owner's notes and screenshots from playing v0.57.3, and what each
turned out to be. They picked: all five fixes, and a **short comfort**
(not silence) after a hand that knocks you out.

1. **"When you have about ten big blinds…" with $1,400.** Lucy in the big
   blind had 70 behind. The brain rightly plays the *effective* stack
   (the smaller one: you can't win or lose more than she has), saw 4-7 big
   blinds, and judged the spot as short: all in or fold. But every
   short-stack line was written for *your* short stack. Now `spot` knows
   `shortBy` (the opponent whose stack makes the hand short, when you
   cover them), judgements carry `n.shortOpp`, and every short-stack line,
   advice, hint, lesson, tip and reminder has a `<key>.opp` wording said in
   its place ("Lucy only has 4 big blinds, so that's all this hand is
   worth"). `{shortOpp}` is a new blank. The lesson `.opp` teaches the same
   term (`shove`).
2. **A draw all in (the bust).** The judge treated "bet your draw" the
   same at any size, and his own bet size rounds up to all in once it's
   45% of your stack. Now `drawShove` weighs going all in with a draw
   (fold chance × the pot, plus your share of the whole pot when called,
   less what you risk) against checking (or, facing a bet, the better of
   calling and folding), with a margin when it's all your chips. Too
   costly: `bet.semi.shove` / `post.raise.semi.shove` (a mistake, never
   clear-cut, since how often they fold is an estimate), close:
   `bet.semi.shove.close`. His advice checks instead when his bet would be
   all in and that doesn't pay (`bet.check.draw.deep`, "See the next card
   for free instead"). A new lesson, `draw-shove` (with its tip and
   reminder), so a repeat never says "Bet it against one player".
   A small all in (less than the pot) with a draw is still fine.
3. **A lesson over a bust.** The semi-bluff lesson came after the
   elimination and read as "that was right". Now a hand that knocks you
   out, or loses half your chips or more, gets one short word and no
   lesson: `comfort.out` / `comfort.hurt` when it was a mistake ("Tap me
   when you want to go over it"), `comfort.out.fine` / `comfort.fine` when
   the play was fine. The verdict and lesson wait for a tap.
4. **Reads that flip.** One bet made an opponent "strong", one call
   "keeps calling". The story now follows the hand: a player who checked
   or called before and bets now has `turned` ("Roxy was quiet before,
   and bets now. They may have just hit something, or they may be trying
   to take the pot. A good hand can still call."); "keeps betting" /
   "keeps calling" only after two (`again`, `story.<kind>.again.one`).
5. **The bubble over the pot.** Across the felt, a long line reached down
   over the pot readout. It now lifts above the pot, never onto the cards
   on the table; where there isn't room it sits as high as the cards
   allow.

Also: "Going…" cut off in a screenshot was him mid-sentence (the bubble
grows as he types), not a bug.

Lab: new TRY IT keys (Lucy is short ×2, the draw all ins, "they wake up",
and two OUT keys that play the hand-that-hurt word). Tests: 5 new checks
for exactly these spots.

## Brain V2: tactical depth before memory (2 Oct 2026)

Owner decision: deepen the live poker judgement before persistent habits,
stages or reports. Memory must not preserve and repeat advice that is still
too coarse. The motivating example is Pocket Queens receiving an all-in
recommendation where a smaller bet might keep worse hands in and win more.

The current limitation is concrete: the judge chooses an action, then a
single stock sizing function supplies the amount. A postflop bet becomes all
in whenever that stock amount reaches 45% of the player's stack. It does not
compare small, medium, large and all-in alternatives, and it cannot explain a
plan for the next street.

Build in six testable slices:

1. **Effective commitment.** Never tell a covering player to risk their whole
   stack merely because an opponent is short. Recommend the exact amount that
   puts the short player all in; say whose stack sets the limit.
2. **Several sizes.** Consider small, medium, large and all-in amounts rather
   than turning one stock bet into a shove.
3. **Value extraction.** Size for calls from worse hands. Safe, very strong
   hands can bet smaller to keep weak hands in; habitual callers can be asked
   for more.
4. **Board-sensitive plans.** Charge draws on wet boards; use smaller bets on
   quiet boards; treat one-pair hands differently from monsters.
5. **A next-street plan.** Advice carries a plain purpose and what to reassess
   if called. This is recorded data for the later hand breakdown, not a new
   visual surface in this pass.
6. **Judge the amount.** Distinguish a good betting idea from a bet that is
   too small, too heavy, or an unnecessary all in.

The first Brain V2 release covers checked-to value betting and the short-stack
preflop sizing boundary. Facing-bet raise sizing uses the same effective cap.
Bluff and draw strategy keep their existing conservative rules until their own
focused pass. Every new recommendation is deterministic, public-information
only and available to the Node sandbox.

### First value slice built (v0.58.1-dev)

- `spot.effectiveTo` is the most any live opponent can match. Preflop and
  postflop raise advice caps itself there. Covering Lucy's 70 behind now says
  "raise to 90 and put her all in", not "put your 1,400 all in".
- `valueBetPlan` produces a preferred amount, four practical alternatives,
  purpose, effective cap and next-street plan. Quiet monster hands keep weaker
  hands in at roughly one-third pot; wet boards use roughly two-thirds to
  charge draws; known callers pay more; an all in is reserved for a strong
  hand when the effective chips left are no more than roughly the pot.
- `judgeBet` compares the player's actual amount with the plan. Too small,
  unnecessarily heavy and unnecessary all-in value bets now get different
  verdicts and explanations. A good idea with the wrong amount is no longer
  automatically praised as a good bet.
- The old draw safety survives independently: a draw bet using a large part of
  the effective chips is still checked against the shove calculation, so the
  sizing upgrade cannot revive the reported draw-bust advice.
- Brain Lab: three Queens spots — quiet-board small value, a wet-board charge,
  and an unnecessary deep all in.
- Proof: 59 brain checks, including the new value matrix; Pattern Book, AI,
  Showdown, quick-bet and scoring suites remain green.

### Advice/verdict consistency fix (v0.58.2-dev)

Follow-up from play: a planned shallow all in was correctly recommended and
judged as a good value bet, but after everyone folded the generic value line
could say a smaller bet might have kept them in. Planned commitments now carry
their own `bet.value.commit` verdict and fold-result wording: P.I.P. explains
that the pot was already large beside the chips left and does not contradict
the advice he just gave.

Next after the tactical pass: a compact **P.I.P. HAND BREAKDOWN** after the pot
is resolved and before the next deal. It will use the structured purpose,
preferred amount, alternative and next-street plan recorded here. It is not
the later persistent **P.I.P. NOTICED** observation format.
