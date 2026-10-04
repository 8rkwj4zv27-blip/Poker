# P.I.P. report — plan

**Status (4 Oct 2026): round 1 lab built, waiting on the owner's picks.**
Lab: https://claude.ai/artifact/GnJ4KYZdMpaYSfqhco4wXk
(`pip-report-lab.html`; candidate `js/coach-report.js` + `css/coach-report.css`).
Nothing in the game has changed yet.

## What was agreed with the owner (4 Oct 2026)

- An end-of-hand breakdown from P.I.P.: "a digital thing to read through",
  CRT, like his bubble but a proper screen. Nearly full screen, **above the
  dashboard** (it may cover the felt and the opponents).
- **Tap only** (in line with the 4 Oct decision on P.I.P.): it never pops up
  on its own. After COLLECT, when the setting is on, the next hand waits
  for a **DEAL** key, and a **REPORT** key (plus a tap on P.I.P.) opens the
  report. The owner is happy to start each hand by hand.
- **Replaces the old Hand Review** (Settings → Hand review, `settings.review`,
  `#review`, `buildReview` in `js/07-ui-wiring.js`). Its saved setting key
  is reused for the new switch so nobody's settings are lost.
- **Same in Career.**
- **A grade, A to F**, for how you played, never for the result, shown
  beside the result. No pluses or minuses (P.I.P.'s judgements aren't that
  precise).
- It shows the four streets with the cards, your chance of winning, the
  pot, your decisions stamped, what their betting said, where it was won or
  lost, and P.I.P.'s summary, one takeaway and a note per street.
- His rules carry over: plain words, no percentages until taught, nothing
  about cards that weren't shown.

## The grade (`CoachReport.grade`)

From the judgements P.I.P. already makes (`verdict` good/fine/mistake,
`confidence` clear/leans/close, `notable`), with each decision's pot (in big
blinds) and the share of your stack it put in:

- faults: clear mistake 3.5, leans 2, close 0.5; a close "fine" 0.25;
- stakes: x1.5 at 25 big blinds or half your stack, x0.6 for a small pot;
- a notably good play earns 0.5 back (never below nothing);
- A ≤ 0.1 and something mattered · B ≤ 1 (or a hand that asked little) ·
  C ≤ 3 · D ≤ 5.5 · F above, or a clear mistake with half your stack at risk.

## A report or not (`CoachReport.worthIt`)

Every hand with a decision past a fold before the flop, or a mistake. A
plain fold before the flop has no report (REPORT stays dark, no lamp).

## Round 1 lab (4 Oct 2026)

One real table with P.I.P. on, held still; seven example hands staged on it
(`js/pip-report-hands.js`): beaten on the river (A, lost), a lucky escape
(D, won), the bluff (A, no cards shown), all in with the cards run (A), the
fold (B), left chips behind (C), a small hand (no report). The marks, reads
and words are hand-written to match the brain; the truth (your chance
against the shown cards) is computed by the report from the real cards
(checked: every showdown winner agrees with `evaluate7`).

Options (TUNE → THE LOOK; first is my suggestion):
- arrives: SWITCHES ON · RISES UP · FLICKERS ON
- pace: PLAYS THROUGH · A STREET A TAP · ALL AT ONCE
- your chance: BAR + TRUTH TICK · ONE BAR · TWO LINES
- grade: STAMPED LETTER · NEEDLE DIAL · PRINTED LINE
- P.I.P. on the screen: HIS FACE · TEXT ONLY
- ink: MARKS IN COLOUR · ALL HIS INK
- numbers: WORDS (not taught yet) · NUMBERS (taught)

Checked in an emulated iPhone (393x852 and 375x667) with real touch: all
seven hands, REPORT, a tap on P.I.P., a street tap, DEAL; Reduced Motion;
no console errors. On a 667px-tall phone the glass scrolls about 50px.

## Next, once the owner picks

1. Into the game: the switch in Settings (replacing Hand review), DEAL and
   REPORT on the console after COLLECT, the report fed from
   `CoachBrain`'s hand record (per decision: judgement, `potBB`, stack
   share; per street: pot, your chips in, the brain's equity as "know",
   `stories()` for the reads), P.I.P.'s lines for the summary, takeaway and
   street notes from `coach-lines.js` (new keys, checked like the rest).
2. The glass becomes a Pattern Book part (`css/crt.css`) and a check in
   `validation/pattern-book-checks.js`.
3. Checks: the grade table, worthIt, pivot, no shown-card leaks.
