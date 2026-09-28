# The Coach — plan

A coach who sits next to you at the table, watches you play and teaches
you poker as you go: what the terms mean, when to push, what went right
and wrong, and how to improve. Agreed with the owner, 28 September 2026.

## What he is

- **A character, but a flat one.** Plain, clear, informative lines with
  the occasional short reaction ("Unlucky. You were ahead until the
  river."). No catchphrases, no nicknames for the player, no mood system.
- **A little old CRT set plugged into the machine** (round 2): switched
  on, it's plonked on the felt, cabled into the console, and a digital
  face warms up on its screen. Keeps round 1's thick glasses.
- **Sits on the felt next to your cards, opposite the dealer deck**
  (Settings → The deck moves him too).
- **Switched on and off from a dashboard button**, with a **talk slider**:
  1. Commentary: reactions only (unlucky, great bluff, bad move)
  2. Debrief: what went right or wrong after a hand, and why
  3. Tips: advice before the big decisions
  4. In your ear: everything, including the deal, opponents' bets and
     every decision
- **Only knows what you know.** Never sees opponents' cards until they're
  shown.

## Accuracy

1. Facts are exact (hand names, odds, pot odds), from the game's own maths
   in `js/01-poker-math.js`.
2. Verdicts carry a confidence level. "Bad move" only when it clearly
   was; close spots are called close.
3. A test suite of hand-built spots with known answers, plus a silent run
   over thousands of simulated hands (`validation/tools/ai-harness.js`) to
   catch nonsense.

## Dialogue engine

Hand-written lines per situation, with blanks the game fills (cards,
opponent name, pot, odds), two or three wordings each, no repeats within
a stretch, and timing that never talks over the opponents' table talk.
No live AI model: works offline, costs nothing, no new dependency.
Target: 600–800 lines.

## Order against the opponents' dialogue (owner, 28 Sep 2026)

The coach goes in **first**, on his own. The Speech Lab
(`speech-lab.html`, branch `claude/tender-dijkstra-zso8dm`, not merged)
already has the bubble (cream card stock, types on, grows to fit), blips
and a talk budget for the opponents. The coach lifts the pieces he needs
from it (bubble, typing, one blip) into the game as shared parts; the
opponents' dialogue plugs into the same parts later, once the owner is
happy with the coach. Proposed and to confirm in the voice lab: one
speaker at a time on the lower felt; the coach speaks clean.

## Build order

0. **Face lab** (round 1 done, round 2: the CRT set): `coach-face-lab.html`, glasses, colour,
   visor, expressions, housing, size, on the real table. Then a voice
   lab with sample lines.
1. Put him in the game: face, seat, dashboard switch, talk slider, saved
   in settings (placeholder lines).
2. Let him watch: game events (deal, bets, your actions, showdown, K.O.).
3. Dialogue engine + notch 1 (~150 reaction lines). First playable.
4. Judge 1: which hands to play, from which seat. Notch 2 for those.
5. Judge 2: after the flop (price of a call, draws, value bets, big river
   bets).
6. Advice before you act (notches 3–4); takes over the old Coach readout.
7. Teaching moments: first-time explanations of each term.
8. Memory: habits across sessions, progress, a session report (new
   storage key; existing settings and lifetime stats untouched).
9. Dialogue expansion.

Open: his name; retire the old Coach and Hand Review switches once he
covers them.

## Round log

- **Round 1 — face** (28 Sep 2026). `coach-face-lab.html` (+
  `js/coach-face-lab-host.js`, `js/coach-face-lab.js`,
  `css/coach-face-lab.css`), candidate `js/coach-face.js` +
  `css/coach-face.css`. Six glasses (browline suggested), frame colour,
  four colours (slate suggested), dealer's visor, six calm expressions,
  three housings (mini cabinet suggested), three sizes. Glasses are a
  vector overlay on a fixed position, so they stay put while the
  expression changes.
  **Picked by the owner:** thick frames (black), slate, no visor, just the
  face (no cabinet), small (60px face), opposite the deck. Now the lab's
  defaults. His expressions stay the calm six.
  Link: https://claude.ai/artifact/J6ihf17j1uz3RatkD1fxYS
- **Round 2 — the set** (28 Sep 2026). Owner: make him more of an AI
  bot, a little CRT TV plugged into the machine and lumped onto the
  table, a digital face rather than a painted one. Same lab and link;
  candidate now `js/coach-tv.js` + `css/coach-tv.css` (round 1's
  `coach-face.*` removed). Options (first is my suggestion): set
  PORTABLE TV (rabbit ears, knobs, speaker) · OLD TERMINAL (badge, stand)
  · TEST SET (handle, knobs under); plastic MACHINE · CREAM · GUNMETAL;
  size; cable INTO THE CONSOLE · COILED · NONE; face PIXEL · DOT MATRIX ·
  VECTOR (one set of shapes, drawn three ways); screen ink from the CRT
  component (machine green, gold, blue); glasses on/off (a dimmer layer
  so the eyes read); eight expressions incl. thinking and talking; idle
  blinks; POWER key (the dashboard button) with PLONKED DOWN + WARMS UP ·
  JUST WARMS UP · INSTANT, and a CRT switch-off. The screen is the game's
  `.crt` component; the face's glow is set locally in the lab, and would
  need a picture role in `css/crt.css` before it ships.
