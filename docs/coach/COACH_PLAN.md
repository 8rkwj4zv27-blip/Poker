# The Coach — plan

A coach who sits next to you at the table, watches you play and teaches
you poker as you go: what the terms mean, when to push, what went right
and wrong, and how to improve. Agreed with the owner, 28 September 2026.

## What he is

- **A character, but a flat one.** Plain, clear, informative lines with
  the occasional short reaction ("Unlucky. You were ahead until the
  river."). No catchphrases, no nicknames for the player, no mood system.
- **The Poker Machine's soul, plugged into a little TV** (round 3): two
  small dots for eyes and a mouth on the screen, pixel art like the chips
  and cards. Switched on from a COACH key next to the table's ⚙, he's
  pulled out from under the table by the dashboard and put down with a
  heavy thud, cabled visibly into that key, and boots with a blink.
  Switched off, he's swiped back off the same way.
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
  **Owner's verdict:** needs a lot of work. Design and face not liked;
  the plonk "rubbish": he shouldn't fade, he should have weight, be
  visibly plugged in, be 2.5D like the coins, heavy thud, a proper blink
  boot. Two small dots and a mouth: the Poker Machine's soul in a TV.
- **Round 3 — the machine's soul** (29 Sep 2026). Same lab and link;
  candidate `js/coach-set.js` + `css/coach-set.css` (round 2's
  `coach-tv.*` removed). Owner's answers: glasses as an option (off by
  default); swiped off the way he came; a COACH key next to ⚙; pixel art
  drawn in code for now; he comes from beside the dashboard, as if pulled
  out from under the table, not from the top of the screen.
  - The set: three pixel sprites drawn in code (PORTABLE with a carry
    handle, knobs and a speaker; CUBE with a brass plate; MONITOR on a
    foot), in MACHINE / CREAM / GUNMETAL plastic, two art pixels per
    screen pixel, a lit top edge and shaded bottom-right like the rest.
  - The face: two 2x2 dots and a mouth on the tube, seven expressions,
    idle blinks and glances (at the pot, a player, you), talking mouth;
    screen ink MACHINE / GREEN / AMBER.
  - The motion, stepped at 14 fps like the 2.5D card, never a fade: up
    from under the near edge (the felt hides him until he's over it),
    held with his shadow on the felt, then dropped: squash, a rock onto
    his front edge, the table jolts, the chips shake (`CoinWorld.shake`),
    pixel dust, a synthesised thud. Or SLID IN FROM THE SIDE. Weight
    HEAVY / VERY HEAVY / LIGHTER.
  - The cable: a verlet rope in pixels from the back of the set to the
    COACH key, swinging as he moves; it goes over the table's edge while
    he's under it, and reels back into the key when he's gone.
  - The boot: power runs up the cable, a clack, the tube's whine, a dot,
    a line, static, dark, then his eyes blink on, blink twice, look left
    and right, and settle; a blip. Switching off runs it back down.
  - Lab only: the COACH key is added next to ⚙ in the copy; it isn't in
    `index.html` yet.
  **Owner:** "now we're getting there". Asked for: the dashboard's colours
  as an option; perspective in the box while he's lifted up (flat 2D once
  he lands); the cable on top of the dashboard like an aux lead rather
  than across the screen (keep the physics); the key next to ⚙ as a
  proper COACH button.
- **Round 3b** (29 Sep 2026). Same link. Plastic DASHBOARD (now the
  default) reads the live theme's case colours (`--theme-case-raised`,
  `--theme-case-hi`), so it follows the theme. In the air the box shows
  its top (lit) and the side towards the middle of the table (shaded),
  drawn in pixels behind the front, up to 7 art pixels deep the higher
  he's held; flat the moment he lands. The lead is now a short aux lead
  to a jack on the dashboard's top edge just below him: it hangs from
  the set while he's lifted, the plug is pushed into the jack after he
  lands (a clack, the jack lights), power runs up it for the boot; its
  slack lies on the dashboard's edge. Switching off pulls the plug out
  before he's swiped off. The COACH key shows a little two-dot TV and a
  lamp.
