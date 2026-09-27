# K.O. and game-over upgrade

The owner asked for a bigger opponent K.O. (the face launched round the
screen stays the heart of it) and a real death for the player's own
dashboard. Round 1 puts every idea on one order form, `ko-lab.html`, running
on the real game. **Shipped in v0.42.0** (`js/knockout.js`, `css/knockout.css`;
the rim fix in `css/dashboard.css`) with the owner's round-3 order below.

Test it here (private Artifact, republished each round):
https://claude.ai/artifact/5aoS18A8PvohCgGhunYY1o

## Today

- **Opponent K.O.** (`playElimination`/`playEliminationGroup`,
  `js/05-game-engine.js`; physics in `js/06-presentation.js`): shocked face,
  two thunks, dead face and K.O.! on their readout, power fail, glitch,
  socket squash, BLAM, the portrait ricochets 3–6 times and leaves through
  the frame; the socket stays dark.
- **Your bust**: no beat of its own. The bust sound and the dashboard's dim,
  then the stage wheel rolls to RUN OVER / EVENT LOST.

## Round 1 options (ko-lab.html)

The opponent's K.O.:

| Job | Options (first = today) |
| --- | --- |
| Length | TODAY · SHORT · LONG · EPIC |
| Build-up | TODAY (thunks) · REF COUNT (3·2·1 on their readout, boxing bell) · THUNKS + COUNT |
| Spotlight | NONE · DIM (all but the doomed seat) |
| Stamp | READOUT · BIG K.O.! (slams on the felt; DOUBLE / TRIPLE; grey OUT! when not yours) |
| Blam | TODAY · SHAKE + FLASH · + DEBRIS |
| The others | NONE · FLINCH · FLINCH + QUIP (a short line on one survivor's readout) |
| Trail | NONE · GHOSTS |
| Face | FIXED · REACTS (new face each hit) |
| Hits | TODAY · SPARKS |
| Other seats | FLIES OVER · SOLID (bounces off them; they rattle and flinch) |
| Slow motion | NONE · FIRST HIT · LAST HIT · BOTH |
| Exit | OFF SCREEN · THE GLASS (flies at you, cracks the screen, slides down) · EITHER |
| Empty socket | DARK · SMOKE · NO SIGNAL · SMOKE + SIGNAL |

Your game over (before the result stage, which is unchanged):

| Job | Options (first = today) |
| --- | --- |
| The killer | NONE · GLOATS (spotlight, smug face, two-word gloat on their readout) |
| The hit | NONE · THUNKS (the dashboard is hit from below; screens glitch) |
| Blown fuse | NONE · ONE · ALL THREE · 1 OR 3 (buttons shot off to pinball round the table; the holes smoke) |
| Your cards | STAY · POP OUT |
| Lights out | TODAY · TILT · CRT OFF (screen collapses to a line and a dot; the stage switches on out of the black) |
| Pace | QUICK · LONG |

## Round 1 order (owner, 27 Sep 2026)

Length TODAY · build-up REF COUNT · spotlight NONE · stamp BIG K.O.! ·
blam + DEBRIS · the others FLINCH · trail GHOSTS · face REACTS · hits SPARKS ·
other seats SOLID · slow motion NONE · exit OFF SCREEN · socket SMOKE.
Game over: killer NONE · hit THUNKS · fuse 1 OR 3 · cards STAY · lights
CRT OFF · pace LONG.

Notes that shaped round 2: the ghost trail was too much; the spotlight read
as a bright box (a visual error), not a light; ejected cards changed design
slightly; more of the dashboard should break, more randomly; and, in the
game generally, the rim light draws a line over the player's cards on
iPhone.

## Round 2 (ko-lab.html, same URL)

The round-1 order is the default. New:

- **Trail** strength: NONE · FAINT · LIGHT · HEAVY (round 1's).
- **Spotlight**: SOFT (a round pool with a long soft edge) · PIXEL RINGS ·
  BEAM, all at about 40% dark and faded in and out. Round 1's box is gone.
- **Exact copies**: anything that flies (cards, buttons, screen glass,
  digits, lamps, the key) is copied with every computed style inlined, so
  it looks exactly as it did in place.
- **Damage**: BUTTONS ONLY (round 1) · CHAIN REACTION (a random handful of
  parts) · TOTAL WRECK; **How much**: RANDOM or BY THE LOSS; **Buttons**
  adds 1, 2 OR 3. **The parts**, each switchable: screens (crack, static,
  switch off, or the glass flies), the stack's drums (spin and jam red, or a
  digit flies), the SB/BB bulbs, the rim light (shorts, then dies), the
  settings key, a snapped bracket (the console hangs crooked).
- **Lights out** adds RUBBLE (it flickers, sputters and dies where it
  stands) and CRT OR RUBBLE. With CRT OFF, the dashboard is repaired while
  the screen is black, so it comes back on rebooted.
- **RIM FIX** test switch (OFF · LAYER · SHADOW · BOTH) for the rim-light
  line over the player's cards. It can't be reproduced in Chromium, where
  the cards already draw in front; the owner checks it on iPhone.

## Round 3 (same URL)

Owner's notes on round 2: stagger multi K.O. launches one after another;
remove the glass crack; the stack drums should really break (spin randomly,
different directions and speeds, overshoot, some pop off); the line through
the cards still shows with LAYER and SHADOW.

- **Multi K.O.**: TODAY (80–140ms apart) · ONE BY ONE (about 0.5s apart,
  each with its own blast, rising) · SLOW (about 1s). Faces join a flight
  that's already running; the ones still waiting rattle in their sockets.
- **No cracks**: screens fail by static, switching off, or the glass flying;
  THE GLASS exit smacks the screen without a crack.
- **Drums**: each spins on its own (direction, drifting speed, run length),
  lurches the other way now and then, overshoots, rolls back and jams red;
  one to three of them (the $ plate too) pop out mid-spin.
- **The rim-light line, found**: `#app .dash-frame::after` (the rim, z-index
  2 in the dock) sits above `#hud-frame`, which normally doesn't matter
  because the cards (`.seat.you`, z-index 6) sit above it. But any filter,
  transform or opacity on `#hud-frame` or `#hud-mid` makes the panel its own
  stacking context, so the cards are flattened into it and the rim draws
  across them. In the game that's the table intro (`.ti-you` filter on
  `#hud-frame`, `tiLamp` opacity on `#hud-mid`); in the lab, the dead-machine
  dim. Reproduced in Chromium (not an iPhone quirk). RIM FIX = FIXED draws the
  rim at `z-index:-1` (under the case) and puts its glow back on the case as
  an inset glow on the top and sides. At rest it is pixel-identical to today
  at 430/390/375/320 wide; lit, only the glow's spill onto the case is
  redrawn. Ships on its own as a game fix, in `css/dashboard.css`.

## Round 3 order (owner) — shipped v0.42.0

Length TODAY · build-up REF COUNT · spotlight NONE · stamp BIG K.O.! ·
blam + DEBRIS · multi K.O. ONE BY ONE · the others FLINCH · trail LIGHT ·
face REACTS · hits SPARKS · other seats SOLID · slow motion NONE · exit OFF
SCREEN · socket SMOKE. Game over: killer GLOATS · hit THUNKS · damage CHAIN
REACTION · how much RANDOM · buttons 1, 2 OR 3 · cards POP OUT · lights CRT
OR RUBBLE · pace LONG · every part on · rim fix FIXED.

## How the candidate sits on the game

`js/ko-fx.js` (with `css/ko-fx.css`) replaces the two elimination
presentation functions with one sequence and wraps `presentResultStage` for a
negative result. The eject is still the game's own `launchPortrait()` /
`stepPortrait()` with `KO_PORTRAIT_PHYSICS_CONFIG`; the candidate only drives
the loop around it. It never touches chips, eliminations, K.O. attribution or
saves. Reduced Motion keeps the game's instant end state.

## Before anything ships

- New sounds (bell, glass, buzzer, CRT off/on, fuse zap, ka-ching) are a
  small synth inside the candidate; shipping moves them into the `Sound`
  module (one context, the iOS unlock, the sound settings).
- TILT writes over the dashboard CRTs, the count writes on the opponent
  readouts, and screen damage covers the dashboard CRTs: those need to go
  through `css/crt.css` / the Pattern Book (`docs/ui/PATTERN_BOOK.md`)
  rather than local styling.
- Damage overlays sit fixed over their part; if the bracket snaps first they
  don't tilt with the console. Shipping should put them inside the part.
- The rim-light fix (round 3, FIXED) ships on its own as a small game fix
  in `css/dashboard.css` (it isn't part of the K.O.).
- The big stamp and the NO SIGNAL socket are new parts: signed off
  and added to the Pattern Book before they're used in the game.
- Ship in small releases (the K.O. first, then the game over), bumping
  `BUILD_VERSION` / `CACHE_NAME` each time.
