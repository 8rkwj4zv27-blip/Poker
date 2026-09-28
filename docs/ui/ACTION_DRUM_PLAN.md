# Action Drum — plan

**Lab link (owner's phone):** https://claude.ai/artifact/Q2qTpSN3k54rkdr3b7ZHgh
(`action-drum-lab.html`; re-stage with `validation/tools/lab-bundle.js` and
republish to the same link after a change.)

## The problem

The bottom console changes mode by two nested CSS flips: `#console-flip`
(the keys ↔ AWARD POT / results face) and, inside its front face,
`#actions-flip` (the keys ↔ QUICK RESOLVE). Both hide the side facing away
with `backface-visibility:hidden` on nested `preserve-3d` elements, a
combination iPhone Safari renders unreliably. The turned-away FOLD / CHECK /
RAISE row is still drawn, mirrored, behind the new face, and its keys' 6px
bases poke out above it (the owner's screenshots: AWARD POT, AWARD MAIN,
BACK TO EVENTS). Desktop Chromium hides it correctly, so it only shows on
the phone.

## The candidate (round 1)

`js/action-drum.js` + `css/action-drum.css`: the sides are faces of one
drum that turns to bring the next one up.

- **Can't ghost.** No `backface-visibility`, no `preserve-3d`: each side is
  projected on its own (`perspective()` in its own transform), JS decides
  which sides face you, and at rest every side but the live one is
  `visibility:hidden` with no transform.
- **No game code changes.** The game still drives the console through the
  `.flipped` classes (`showAwardConsole`, `syncQuickResolveControl`,
  `activateResultsConsole`, `endQuickResolve`...). The drum watches them
  and turns to match; every id, button and handler stays put. Taps are off
  while it turns (about a third of a second).
- Reduced Motion: an instant swap.

Lab choices (first option = suggestion): mechanism (DRUM / REEL past blank
sides / FLAT FLAP / today's flip to compare), speed, landing (clunk /
bounce / glide), motion (chunky 20 fps / 12 fps / smooth), direction,
shading, drum panels, the window lips, sound.

## Round 1 picks (owner)

DRUM · 4 SIDES, MEDIUM, CLUNK, CHUNKY · 20 FPS, **ALWAYS DOWN**, shading
ON, drum panels WHILE IT TURNS, the window WHILE IT TURNS, TICKS + CLUNK.
These are now the candidate's defaults.

## Round 2 (the owner's notes on round 1)

- **The keys line up.** AWARD POT, QUICK RESOLVE and the results keys were
  drawn to the side's full height, so they sat about 9px higher than
  FOLD / CHECK / RAISE. Every side's keys now take the row's measured top
  and height (`--ad-key-top`, `--ad-key-h`, set by `layout()`); checked
  equal to the pixel on a tall (844) and a short (667) phone.
- **A housing to turn inside.** The bay is a dark well with a fixed bezel
  drawn over the drum (ink border, a thin brass ring), and the drum is
  clipped to the bezel's opening while it turns.
- **More room.** The key bay is 10px taller in portrait (101px; 94px on
  short phones), most of it as air between the instruments and the bezel.
  That 10px comes out of the felt.

## Round 3 (owner: "spot on", two notes)

- **The rim's glow runs on round the bay.** The lit rim's inner glow on
  the case was drawn on the dashboard half only (`#hud-frame`,
  `css/dashboard.css`), so it stopped dead at the key bay. The bay now
  carries the same glow down its sides and along its bottom, in the same
  lamp (`:has()` reads `data-rim` off `#your-seat-dock`).
- **Knock to check is back** (`js/knock-check.js` + `css/knock-check.css`).
  It was in the owner's signed-off Dashboard V2 order (Pattern Book,
  Behaviours: ON) but only ever lived in the order form, never the game.
  Ported from `js/dashboard-order.js`: double-tap the dashboard case to
  check (`humanAct('check')`); facing a bet it refuses with a buzz and
  CAN'T KNOCK; the whole machine (dashboard and key bay) jolts. Not the
  bank, your cards or a key.

## After sign-off

1. Wire the picked drum into the game: load `action-drum.js`/`.css` and
   `knock-check.js`/`.css` from `index.html` + `sw.js`, install the drum at
   boot, and retire the two flips' transform rules in
   `css/03-action-console.css` (the `.flipped` classes stay as the game's
   signal).
2. Add the drum to `docs/ui/PATTERN_BOOK.md` and a check to
   `validation/pattern-book-checks.js` (no hidden side visible once a turn
   has settled).
3. Bump `BUILD_VERSION` / `CACHE_NAME`.

## Shipped: v0.48.0 (28 September 2026) — see below for v0.48.1

Owner: "this all looks really good to me". The drum (the round-1 picks),
the round-2 housing and key line, the round-3 glow and knock to check are
live: `js/action-drum.js`, `css/action-drum.css`, `js/knock-check.js`,
`css/knock-check.css`, loaded by `index.html` and precached by `sw.js`.
Recorded in `docs/ui/PATTERN_BOOK.md` (Action drum) and checked by
`validation/pattern-book-checks.js`.

- The two flips' old rules in `css/03-action-console.css` stay as the
  fallback if the drum can't install; `html.ad-drum` stands them down.
- The knock's refusal shakes the whole screen (`#hud-status-normal`, the
  hand line and turn lines together) rather than the turn-line CRT alone:
  only `css/crt.css` may animate a CRT (Pattern Book rule).
- Checked in an emulated iPhone at 390 x 844, 430 x 932, 375 x 667 and
  landscape: the drum is on at boot, a real showdown lands AWARD POT on
  the FOLD line and turns back, the knock refuses facing a bet. Not
  checkable here: real iPhone Safari, where the old ghost showed.

## v0.48.1: NEXT HAND on the drum (the owner: "NEXT HAND just appears")

NEXT HAND, REBUY and NEW TABLE were never part of the console: separate
`.wide-btn`s the game unhides between hands, NEXT HAND pinned over the
key bay in portrait, so they popped up over the drum. They are now a
fifth side (`#ad-face-deal`): moved onto the drum at install (same ids,
same handlers; `uninstall()` puts them back), in the console's key
(`.btn-award-console`, NEW TABLE beside REBUY in `.results-secondary`).
The game still only unhides and hides them. Order of sides when several
apply: AWARD / results, then the deal side, then QUICK RESOLVE, then the
keys. A pressed deal key is hidden by the game at once, so the drum holds
it (`.ad-hold`) on the side until it has rolled away.

## Round 4 (lab): the AWARD KEY for your wins

The owner: "design a cooler button for award pot, a bit sexy for wins".
Candidate `js/award-key.js` + `css/award-key.css`, lab only (the AWARD
KEY tab). It learns whose pot it is by wrapping `showHudResultConsole`
(called just before every AWARD key) and puts the shared key in a
`data-ak="mine"` state: a finish (POLISHED GOLD with a stepped glint /
VELVET + GOLD / LIT FROM UNDER / today), the words (COLLECT, AWARD POT,
YOURS, TAKE IT) with the amount on a cream plate or printed, a flash as
the drum lands it, gold sparks and the counter's clack when pressed, more
shine for big and monster pots, and optionally a quiet PAY HARRY key for
someone else's pot. No chasing lights (struck from the Showdown). The
game's own words stay as the key's aria-label.
