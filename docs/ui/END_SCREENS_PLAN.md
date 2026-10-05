# End screens — plan (EVENT WON / EVENT LOST)

**Lab link (owner's phone):** https://claude.ai/artifact/6K6poGQZ1d8yNFzfbdAiUZ
(`end-screens-lab.html`; re-stage with `validation/tools/lab-bundle.js` and
republish to the same link after a change.)

## The owner's brief (29 Sep 2026)

EVENT LOST went from a destroyed dashboard to a fixed one, and the big
RESULT well said one line. Wanted: more interesting, easy-to-read stats in
the same visual language. Picked from the proposal: a chip-stack chart
with K.O.s marked, **bust-out order**, **best hand**, **luck meter**. The
button drum should slowly spin round to BACK TO EVENTS. P.I.P., if he's on
the table when you bust, starts to blink and is blown off the screen,
violently, to the moon, and his cable snaps.

## What's built (round 1, v0.58.0, on branch `claude/event-end-screens`)

- **The recorder** (`js/event-tape.js`). `finishHand()` calls
  `EventTape.afterHand()` once per settled Career hand, after the
  eliminations: your stack and the blind level (the tape), who went out,
  their place and who beat them (the engine's own decisive-pot rule), your
  best showdown hand (`updateTrackedBest`). A wrapper on `advancePhase`
  notes your odds when an all-in has nothing left to bet (a runout;
  `Showdown.equities`). The all-in's result is your share of the contested
  pots you were in. Read-only: no chip, pot, K.O. or settlement changes.
- **The save.** `g.tape` rides in the Career table save (`snapshot.tape`,
  sanitised by `EventTape.clean` on both write and restore). Approved by
  the owner. An old save simply starts a fresh tape at the next hand.
- **The well.** With a tape, `careerStageModel()` gives
  `detail.kind:'tape'` (same line and sub as before) and
  `stageDetailHTML()` asks `EventTape.html()`:
  - CHIP TAPE: a stepped pixel trace drawn in by a pen (20 fps, a tick a
    hand, a thunk on a K.O.). Dashed start line, blind-level ticks, peak
    flag, K.O. bursts. A bust flatlines to the edge with a tone; a win
    reaches the ALL CHIPS line. Drawn on canvas in the CRT's own ink.
  - BUST-OUT ORDER: faces, first out on the left, place and hand; your
    K.O.s carry a burst; after a bust, who got you is lit, the rest STILL IN.
  - BEST HAND (mini cards) beside the LUCK METER (a needle gauge: all-ins
    won against what the odds said; RAN BAD … RAN HOT).
  - Room: the HANDS/FIELD/PRIZE recap row steps out on tape stages; on
    ≤700px-tall phones FINISH/OUTLASTED too. Checked at 430×932, 390×844,
    375×667.
- **The wreck stays** (`js/knockout.js`). After a bust the dashboard is left
  broken and smouldering under RUN OVER / EVENT LOST; only the key bay gets
  power back. It's repaired once the result stage (or the table) is gone.
- **The limp** (`js/action-drum.js`, `ActionDrum.limp(onLand)`): that turn
  goes the long way past the blank sides, catching, slipping back and
  grinding at 12 fps (2.6 s), a heavy clunk, then the BACK TO EVENTS bay
  stutters on.
- **P.I.P. to the moon** (`js/coach-set.js`: `panic()`, `blast()`, `stow()`).
  He blinks and beeps as the dashboard takes its hits; the first blast
  launches him spinning off the top of the screen; his lead goes taut and
  snaps (the frayed end stays on the dashboard, sparking) and he twinkles
  out. He comes back the usual way at the next table. On a win (or any end
  he isn't blown up in) he hops twice and ducks under the table.

## Round 2 (owner, 5 Oct 2026): the cabinet (v0.58.1)

"Very CRT": build it as a cabinet with the CRTs inside. Done: the well is
one `.pc-raised .pc-material-plastic` panel (the FINISH / OUTLASTED deck's
moulding); CHIP TAPE, BUST-OUT ORDER, BEST HAND and LUCK are `.pc-label`s
printed on the casing; the tape keeps its big screen; bust-out faces sit in
`.pc-recess` portrait windows with name and finish printed under them;
best hand unchanged; LUCK is a 15-cell strip meter (BAD … HOT, lit out from
FAIR in the middle) instead of the needle dial. Owner: keep it less busy (no
faces on the tape itself).

## Round 3 (owner, 5 Oct 2026): screens in the cabinet (v0.58.2)

Round 2 "went too far": printed words with an indent on the casing exist
nowhere else in the game. Now:

- Every section is a screen fitted into a plastic panel; **no words on the
  casing**. Bust-out order is its own screen again.
- **All four end screens**: the big number is physical drums (the STACK's
  gold-framed reel) in a sunk bay in the hero panel, with the label and the
  carry on a small screen beside them (`stageHeroHTML`). The progress strip
  gets a plastic frame. Header back to full size; spacing from two tokens.
  `css/result-cabinet.css`.
- Event screens: FINISH / OUTLASTED moves onto the bust-out screen's header
  ("YOU FINISHED 3RD OF 4") so the tape keeps its room on a standard iPhone.
- P.I.P. on a win: `presentResultStage` waits for `CoachSet.clearTable()`
  (he hops and drops under the table) before the stage turns.
- The lab's LOOK tab, every row live (first = my suggestion), saved as
  `data-es-*` on `<html>` (`EventTape.LOOK` / `EventTape.look()`):
  THE BIG NUMBER (drums on the casing / on the glass / big drums, no frame),
  SPACING (standard / roomy / compact), FINISH / OUTLASTED (on the bust-out
  screen / its own panel), CHIP TAPE (tall / medium), BUST-OUT ORDER (row /
  list / faces only), LUCK (word + strip + numbers / strip + numbers /
  word + numbers), SE PHONES (stage scrolls / shrink to fit). Moments for all
  four end screens. COPY MY PICKS for the owner's order.

## Signed off (owner, 5 Oct 2026) — live in the game, v0.58.3

The owner's order from the lab's LOOK tab, now `EventTape.LOOK`:
THE BIG NUMBER: BIG DRUMS, NO FRAME · SPACING: STANDARD · FINISH /
OUTLASTED: ON THE BUST-OUT SCREEN · CHIP TAPE: TALL · BUST-OUT ORDER: FACES
ONLY · LUCK: WORD + STRIP + NUMBERS · SE PHONES: STAGE SCROLLS.

## For the Pattern Book

New parts approved with the order above (to be written into the Pattern Book): the chip tape, the
bust-out portrait window, the luck strip. The glass, ink and type are the shared
CRT; `css/event-tape.css` is layout only.

## Checks

`node validation/event-tape-checks.js` (14), and the existing
`career-result-checks.js` (its model-shape check now includes `tape` and
`alive`).
