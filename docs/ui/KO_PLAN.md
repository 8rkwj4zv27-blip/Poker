# K.O. and game-over upgrade

The owner asked for a bigger opponent K.O. (the face launched round the
screen stays the heart of it) and a real death for the player's own
dashboard. Round 1 puts every idea on one order form, `ko-lab.html`, running
on the real game. Nothing here is in the game yet.

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
- TILT writes over the dashboard CRTs and the count writes on the opponent
  readouts: those need to go through `css/crt.css` / the Pattern Book
  (`docs/ui/PATTERN_BOOK.md`) rather than local styling.
- The big stamp, the crack and the NO SIGNAL socket are new parts: signed off
  and added to the Pattern Book before they're used in the game.
- Ship in small releases (the K.O. first, then the game over), bumping
  `BUILD_VERSION` / `CACHE_NAME` each time.
