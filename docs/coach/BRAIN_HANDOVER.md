# P.I.P., the Coach: handover for a fresh session

Written 29 Sep 2026. `main` is **v0.57.3** (PR #48, from another
session: you can pick P.I.P. up and throw him round the screen, a joke the
owner asked for; see below). The brain is as at v0.57.2 (PR #47). This replaces the
first handover (the brain has since been built). Read this, then
`CLAUDE.md` for the house rules. Open `docs/coach/BRAIN_PLAN.md` only for
the full history of how each part was decided (it's long; sections are
dated), and `docs/CODEMAP.md` for the rest of the game.

## The one-paragraph version

P.I.P. (Poker Intelligence Personality) is a little pixel TV on the felt
that coaches the player at Texas Hold'em. He's live on the owner's phone.
He watches every decision; judges it (good / fine / mistake, with how sure
he is); advises **before** you act (the HELP dial); says a word **after**
you act; gives a verdict and a lesson **when the result is shown**; reads
what the other players' betting means; and answers taps on his screen. He
speaks plain English and teaches poker words as you go. What's **not**
built: memory of your habits across sessions, and the "stages" that grow
with the player (parked by the owner), and "Ask P.I.P." question keys
(parked). The owner is currently playing him and sending notes: **the next
job is whatever the owner reports, refined in small steps.**

## Working with the owner (read this first)

- **Ask before building anything substantial, and stop when told.** The
  owner has twice said "stop, don't go ahead yet" when a session jumped
  from a question to building. If a message ends in a question ("where do
  we go from here?", "is that possible?"), answer and propose; build only
  on a clear "go ahead".
- **They judge by playing on their phone.** Every change goes into the
  **P.I.P. Brain Lab** (a private Artifact link) and, when they say so,
  into the game through a PR that **they have asked you to merge** ("pushed
  and merged so I can play on my phone"). Don't merge unasked.
- **They send screenshots and exact lines.** Treat a quoted line as a bug
  report: find out *why* he said it before changing words.
- **Plain English to the owner too.** They're learning poker; explain
  poker terms when you use them in chat.
- Things they've been clear about:
  - **Advice, not facts.** Every line says what's happening, what it means
    for you, and what to do. "Tony limped and has checked every street" was
    rejected as pointless.
  - **Timing is key.** Never say anything about the player's cards before
    they're turned over; the verdict comes when the winner is shown, before
    COLLECT; never carry a verdict into the next hand.
  - **No jargon unless taught.** Poker words appear only after a lesson has
    taught them (the terms system, below). "Keep it simple and plain
    English for now; learn the terms as you play longer."
  - **Don't repeat himself.** They notice repeated lines quickly.
  - **Flat voice**: plain, clear, the odd short reaction; no nicknames, no
    catchphrases, no puns; clean.
  - **Bluffing matters** to them: when to, when not to.
  - His key shows **his face** (they said "P.I.P." letters couldn't be read).

## Where everything lives

| File | What it is |
| --- | --- |
| `js/coach-set.js` + `css/coach-set.css` | His pixel TV, the lift on/off, the lead and plug, the boot, his face and mouth, the key beside ⚙ (`keyFace:'face'`). Since v0.57.3: drag him off the felt and let go, he tumbles, bounces off the screen's edges and flies back (a tap without a drag still gets his read; off with Reduced Motion). **Signed-off look (Pattern Book: Coach); don't redesign.** |
| `js/coach-brain.js` (`CoachBrain`) | The brain. Pure functions over the game state, no DOM: runs in Node for tests. |
| `js/coach-lines.js` (`CoachLines`) | The line library (~510 lines, ~355 keys) and `TERMS` (poker words). |
| `js/coach-talk.js` (`CoachTalk`) | His voice and bubble, and all the routing: when he speaks, what, taps, the HELP and TALK dials, the terms memory. Also ~80 base lines (`LINES`: results, "your turn", reactions). |
| `coach-brain-lab.html` + `js/coach-brain-lab.js` (+ host) | The lab: TRY IT (35 set spots), HIS VERDICTS, TALK/HELP dials, KEY. Link: https://claude.ai/artifact/93fSUyPJJemnRhGkq7yXyJ |
| `validation/coach-brain-checks.js` | 51 checks (about 2 minutes). |
| `validation/tools/coach-sandbox.js` | The sandbox the checks share: real math + brain + lines + the engine's `computePots`, a seeded `Math.random` (`PIP_SEED=n` for another run), a hand-built table and the engine's bookkeeping for actions. |
| `docs/coach/BRAIN_PLAN.md` | Every decision, dated. Append a section per round. |

Settings (in `felt.settings`): `coachBot` (on/off, default off),
`coachTalk` '1'-'4' (default '4'), `coachHelp` '1'-'4' (default '3').
His own storage: **`pip.coach`** (`{ terms: { <lesson>: timestamp } }`,
the lessons he's taught). Existing settings and lifetime stats must never
be touched (CLAUDE.md).

## How the brain works (`js/coach-brain.js`)

- **`spot(g, me)`**: the decision in front of you, read *before* the
  action is applied: seat (BTN, CO, HJ, LJ, UTG...), players acting after
  you, stacks in big blinds, pot, price, pot odds, the situation (unopened
  / limped / raised / reraised; facing-bet / checked-to / first), your
  hand's rank (`preflopPercentile`), after the flop your made hand, draws,
  outs, board dangers, the public action log, and each opponent's public
  habits (`g.reads`). **Only your cards and public facts.**
- **`judge(sp, choice)`** routes to:
  - `judgePreflop`: open ranges by seat (`OPEN_RANGE_BY_BEHIND`, copied
    from the AI), raise or fold (limping is a mistake; the small blind
    completing is fine), raising limpers, the big blind, facing a raise or
    re-raise (your equity against what the raise usually means, discounted
    for position, against the price), short stacks (all in or fold,
    `PUSH_RANGE_BY_BEHIND`). Small pairs are rated like the charts.
  - `judgePostflop` (facing a bet): equity against each opponent's range
    (`oppRange`: their preflop action, habits, then every action since,
    narrowed by the AI's own `narrowWeight`) vs pot odds (plus implied odds
    for strong draws). **Raising for value needs two pair or better**; top
    pair calls.
  - `judgeBet` (checked to you): value-bet strong hands (checking them is
    `bet.missed`), check middling ones, semi-bluff a strong draw against
    one player, bluff only one player who's shown weakness and isn't a
    caller, when they fold often enough (`foldChance` vs bet/(pot+bet)).
    **A bluff is never judged clear-cut.**
  - A judgement: `{ kind, best, verdict: good|fine|mistake, confidence:
    clear|leans|close, tag, lesson, notable, n: numbers }`. The quoted
    numbers always agree with the verdict (tested).
- **`advise(sp)`**: judges every move you could make; his move, how sure
  (from the next-best move), the size (2.5bb opens + 1 per limper; 3x a
  raise in position, 3.8x from the blinds; bets ½ pot, ⅔ on wet boards
  and the river; to the half big blind), and `stories`.
- **`stories(sp)`**: what each opponent's betting says (weak / strong /
  calling / quiet) plus habits (caller, bluffer, loose, tight).
- **`settle(g, me)`**: your result at the showdown **before COLLECT pays
  it**, from the game's own `computePots` and the hands shown.
- **Hand record**: `handStart`, `record` (spot + choice + judgement),
  `observe`, `handEnd`, `closeMissed` (a hand that ended between looks),
  `history` (last 50, this session). Equity is sampled once per spot
  (a WeakMap), 1,500 samples.

## How he talks (`js/coach-talk.js`)

- **Hears the game** by wrapping `applyAction` (spot before, record
  after) and `updateCoach` (the engine's "your turn" signal; the old
  Coach panel it drove is retired, keep the function), and a 200ms
  watcher on `game.handNumber` / phase. **Don't wrap `startNewHand`**
  (other code swaps it).
- **Timing**:
  - your cards: only once `game._humanCardsVisible === true`;
  - the end of a hand: when `#console-flip` has class `flipped` (the award
    screen with the COLLECT key), **whatever the phase**. When everyone
    folds straight away the phase stays 'preflop': that was a bug;
  - the verdict is spoken at that moment, in place of the plain result
    line, never carried into the next hand (`debrief(h, onScreen)`);
  - leftover talk waits while new cards are face down (`afterTalk`).
- **The dials**: TALK (1 COMMENTS · 2 DEBRIEF · 3 TIPS · 4 IN YOUR EAR) is
  how often; HELP (1 WATCH · 2 HINTS · 3 ADVICE · 4 TELL ME) is how
  directly he advises before you act. A judged line's notch comes from its
  confidence (clear mistake 1, notable good 2, lean 3, close 4).
- **Advice** on your turn (`yourTurn`): at TIPS on big decisions, at IN
  YOUR EAR on all but junk folds; a story line leads it after the flop.
- **A word after you act** (`wordNow`): one per hand, praise rationed, the
  same word not repeated within 2-4 hands, no praise for following his
  advice.
- **The verdict** (`verdictOf` / `debrief`): the decision that mattered
  most (later streets and bigger pots weigh more), with a lead ("You won
  it, but...", "You lost, but you played it right", "You won 108, but you
  could have won more"), `.why.foldwin` lines when everyone folded, a
  lesson the first time, a short `again.<lesson>` reminder on repeats.
- **Taps** (`onTap`): a list of things for the moment (your turn: read →
  lesson → tip; result: verdict → lesson → tip → big-hands tip; folded:
  watch tip), stepping forward, skipping anything already said this hand,
  then `tap.done`. Never loops.
- **Terms**: lines write `{t:limp}` etc.; plain words until the lesson
  that teaches it has been shown (`learnFrom`), then the term. Seats
  likewise (`seatFrom`: "one seat before the dealer button" → "the
  cutoff" after `lesson.position`).
- **No repeats**: `choose()` uses every wording of a key before reusing
  one (session).
- **Fill**: `{slot}`, `{Slot}` (capitalised), `{t:term}`; a sentence that
  starts with a lower-case blank gets its capital.

## Lines (`js/coach-lines.js`) key scheme

`dealt.<band>.<seatgroup>`, `<tag>.now[.leans]`, `<tag>.why[.leans|.foldwin]`,
`lesson.<l>`, `again.<l>`, `tip.<l>`, `lead.*`, `advise.<kind>.<move>[.draw|.bluff]`,
`hint.<kind>`, `story.<kind>.one|all`, `habit.*`, `read.*`, `explain.*`,
`sum.*`, `tap.done`. The checks enforce: every judge tag that can be
spoken has lines, every lesson has `again.` and `tip.`, only known blanks,
≤200 characters, no nicknames/swearing, **no poker jargon outside
`lesson.*` / `explain.*`** (the `JARGON` regex), every term has plain
words and a lesson.

## Testing

- `node validation/coach-brain-checks.js` (51 checks, ~2 min; all green at
  v0.57.3), plus `pattern-book-checks.js` (guards: the Coach never changes
  game state, never reads the deck, reads an opponent's cards only in
  `shownAtShowdown`: **name variables `handNo`, never `x.hand`, or it
  trips**), `ai-behaviour-checks.js`, `showdown-checks.js`,
  `quick-bet-checks.js`, `scoring-checks.js`.
- Real game: `python3 -m http.server 8765`, then Playwright via
  `validation/tools/touch-harness.js` (iPhone emulation). Useful:
  `index.html?dev`, `settings.coachBot=true`, `startGame()`, a
  `MutationObserver` on `.ctk` bubbles to log what he says, `humanAct()` to
  play. **`FAST_DEV=true` auto-presses COLLECT**, so test timing at normal
  speed and click `#btn-award-pot-console` yourself. A headless hand takes
  ~20-30s at normal speed.
- Known, not the Coach's: a `TypeError ... reading 'build'` from
  `js/coin-bank.js` on the first Quick Deal.

## Releasing (every time)

1. Bump `BUILD_VERSION` (`js/02-support-systems.js`) and `CACHE_NAME`
   (`sw.js`).
2. **Give every changed file a new `?v=` in both `index.html` and
   `sw.js`** (missing one lets a phone mix cached old files with new
   ones: a freeze once; v0.57.2 fixed one I missed).
3. Run the suites; play a few hands in the harness.
4. Lab: `node validation/tools/lab-bundle.js coach-brain-lab.html
   <scratchpad>/bundle-brain`, publish with the Artifact tool (`root` =
   the bundle, `files` = the changed paths; PNG faces need
   `contentType: image/png` on a full publish), **same link** (the URL
   above; pass it as `url` from a new session after reading it).
5. Commit, push, PR; merge only when the owner asks. After a merge,
   restart the branch from `main`.
6. The owner checks Settings → bottom: "Build v0.57.x-dev · ...".

## Parked, and what's next

- **Now**: the owner is playing v0.57.3 and will send notes. Fix what they
  report: small, tested, into the lab, into the game when they say.
- **Parked by the owner** (don't start unasked):
  - "Ask P.I.P." question keys in his bubble ("Should I have just called?"
    etc.), hand-written answers.
  - Memory across sessions (habits: hands played, limping, calling raises
    light, chasing draws, missing value, bluffs), progress remarks, the
    five **stages** that grow with the player, a session report, a
    glossary. Two open questions for them: stages visible or behind the
    scenes? Report in his bubble or a printout card?
- **Ideas noted, not agreed**: Hand Review (Settings) could be folded
  into P.I.P.'s verdict and retired (ask first); the opponents' own table
  talk (`speech-lab.html`, unmerged) would share his bubble.
- Honest limits today: fold chance for bluffs is an estimate from habits
  and checks; equity is sampled (±1-2%), so edge verdicts are "close"; bet
  sizing is only judged for value bets that are tiny.

## Environment notes (Claude Code on the web)

- Commands can be refused for a while by the permission check ("no
  verdict"); after 10 in a row the turn stops. **Commit and push early**;
  when it happens, do read-only work and try again later.
- Branch for this work so far: `claude/hopeful-cori-uvxcvv` (a new
  session will likely be given its own).
