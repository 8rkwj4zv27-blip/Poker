# Code map

Where things live, so a session can jump straight to the right file instead
of searching. Read this once per session when the task isn't already
pointing at a specific file. It is a map, not a spec — behaviour is defined
by the code and by `CLAUDE.md`/`AGENTS.md`, not by this file.

## Load order (`index.html`, mirrored in `sw.js`)

```
01-poker-math.js        02-support-systems.js   03-opponents.js
04-modes-and-scoring.js 05-game-engine.js       06-presentation.js
coin-world.js           coin-table.js           07-ui-wiring.js
career-hub-live.js      career-motion-live.js   machine-wheel.js
ticket-feed.js          table-intro.js
08-dev-mode.js          home-cast.js            home-boot.js
crt.js                  finishes.js             press-feel.js
```

Later files call into earlier ones freely; there's no module system, so
everything is a global. `08-dev-mode.js` (the DEV panel) is the only file
gated out of the page entirely when `DEV_MODE` is off.

## `js/01-poker-math.js` (~320 lines)

Pure card/hand math, safe to run inside the AI worker. `createDeck`,
`shuffle`, `evaluate7` / `evaluate7WithCards` (best-5-of-7 hand evaluation),
hand-name/description helpers. No DOM, no game state — if you need a poker
rule question answered precisely, it's answered here.

## `js/02-support-systems.js` (~1,500 lines)

Grab-bag of self-contained systems: cartoon face SVG generation
(`faceSVG`), `localStorage` wrapper (`Store`), settings, `motionOff()`
(Reduced Motion check), `haptic()` (no-ops on iOS — see below), and the
entire `Sound` module (procedural Web Audio, ~500 lines from `doButtonPress`
down to `stageRollClick`/`stageLockSound`). `BUILD_VERSION` is declared
here (~line 736) — **bump it on every release** so the main-menu footer
shows what's installed; keep its version number in sync with `sw.js`'s
`CACHE_NAME` (the `card-flight`/`card-turn`/`chip-motion`/`showdown-rail`
checks assert this).

## `js/03-opponents.js` (~660 lines)

AI. `PERSONALITIES_ALL` (the 8 base archetypes: rock, shark, maniac,
station, grinder, wildcard, professor, hammer — sizing/tightness/aggression/
bluff dials), `aiDecide()` (the actual decision function — difficulty,
position, stack depth and paid-place pressure all weight into this, never
hidden cards), face-colour/personality assignment for a fresh table.

**Note:** `HISTORY.md` documents an "Enemy / Personality Pass" (named
residents Harry/Tony/Lucy/Nigel/Steve, `js/03-residents.js`, House Faces,
dossiers) as code-complete. Checked 2026-09-24: **it was never actually
committed** — there is no `js/03-residents.js`, no `residentId`, no House
Faces screen in this codebase, only the anonymous `PERSONALITIES_ALL`
archetypes above. `HISTORY.md`'s own entry says "Not committed... the owner
still gets the final visual review"; that review evidently didn't happen or
didn't land. Don't assume residents exist without checking the code first.

## `js/04-modes-and-scoring.js` (~1,740 lines)

Game *formats*, not game *state*. `TOURNAMENT_FORMATS` (turbo/deep/headsup
descriptors), `BLIND_LEVELS`, the Career event catalogue (`CAREER_ROOMS`,
`CAREER_EVENT_LIST`, per-event descriptors), Career naming/threat helpers
(`careerEventTitle`, `careerThreatOf`), and the scoring/award system (the
objective award catalogue — `POT WINNINGS`, `BIG WIN`, `MONSTER HAND`,
`K.O.`, `EVENT WON`/`TABLE CLEARED` — see `docs/scoring/SCORING_SPEC.md` for
the authoritative rules on all of this).

## `js/05-game-engine.js` (~3,600 lines, the largest file)

The actual game state machine. `game` (global state), `newGame()` (table
setup — accepts `opts.roster` for Career's pinned field), `applyAction()`
(every betting decision funnels through here), hand lifecycle
(`startNewHand`, `finishHand`, `resolveEliminations`), Career table
persistence (`saveCareerTable`/`loadCareerTable`/`restoreTable`),
`careerFinishPlace()` (placement is measured from the table, never
inferred), and the shared result-stage model (`careerStageModel`,
`resultStageHTML` — one chassis for `TABLE CLEARED`/`RUN OVER`/`EVENT WON`/
`EVENT LOST`). If a poker rule or Career settlement number looks wrong,
it's almost certainly in here.

## `js/06-presentation.js` (~4,800 lines, second largest)

Rendering and animation only — reads `game`, never mutates poker state.
`render()` (the main table repaint), `initSeats()`, card flight/deal
animation (`DealFX`), chip flight/pile animation, the coach/hint system,
Hand Review panel, showdown presentation. If a visual bug doesn't affect
outcomes (wrong chip count on screen, a card animating oddly, a stat
misdisplayed), it's here, not in `05-game-engine.js`.

## `js/coin-world.js` + `css/coin-world.css` — the gold-coin world

The chip upgrade's physics world (docs/ui/CHIP_PLAN.md): every coin on the
felt a body (arcs, spin, bounces, stacks, topples), pixel coins drawn by
code, walls from the live table, bet-spot/pot zones, ten procedural sound
sets. Exposes `window.CoinWorld`; does nothing at load. Built in
`chip-throw-lab.html`, which runs on it.

`js/coin-table.js` is the game's side (`CoinTable`, presentation only):
lays the pot tray, bet spots and walls over the live table; throws every
bet and blind onto its spot (`applyAction`/`postBlind`); sweeps spots into
the tray (`advancePhase`, `handleFoldWin`, `handleShowdown`); pays winners
(`payoutTo`, and the pot smash's burst in `runPotBreakPhysics`); owns your
bank as a coin rack in `#hud-left` (`renderBank`,
`rebuildBankPileFromState`, the table intro's bank load); plays the
`settings.coinSound` set. Every hook is behind `coinTableOn()`
(05-game-engine.js); `COIN_TABLE_ON=false` restores the old chip piles.

## `js/07-ui-wiring.js` (~2,000 lines)

Screen navigation and all Career money/transaction logic.
`showTableScreen`/`showCareerScreen`/`renderCareerScreen`, the single-player
menu-launch sequence (`stageInitialRunArrival` etc.), and every Career
money function: `enterCareerEvent`, `settleCareerEvent`, `startCareerEvent`,
`continueCareerEvent`, `startCareerCashSession`/`endCareerCashSession`,
`saveCareer`. **This is the one place Career's money rules are enforced** —
buy-in debited and persisted before the table exists; settlement guarded
against duplicate credit; `felt.career` is the sole authoritative ledger.
Don't duplicate a transaction path elsewhere.

## `js/career-hub-live.js` + `js/career-motion-live.js` + `css/career-motion-live.css`

The live (production) Career Hub presentation: the touch-physics event
rack, ticket cards, buy-in sequence, and the Home↔Career↔table motion
transitions (`careerDepartToTable`, the Home entrance in
`enterCareerFromHome`). Reads Career state and calls the real transaction
functions in `07-ui-wiring.js`; owns no money itself. Styled by
`css/career-hub-v2-lab.css` (shared with the Lab, see below) plus
`css/career-motion-live.css` for the transitions and
`css/career-hub-cabinet.css` (live-only layout: Back/Settings keys on the
top rail; one dark console housing the ticket slot — cartridge-hole mouth
over a readout whose text `career-hub-live.js` keeps in step with the
ticket state and the feed — plus the main button and Abandon/Cash Out; the
old bottom `.setup-head` strip is hidden). Chosen in `slot-lab.html`
(option B, mount 3).

## `js/machine-wheel.js` + `css/machine-wheel.css` — Machine Wheel V2 (live)

The three screen-change rolls (table <-> results stage, Home -> Career,
Career -> table): one pixel-snapped drum engine (`machineWheelRig`) plus
`rollStageTransitionV2`, `enterCareerFromHomeV2` and
`careerDepartToTableV2`, each keeping its V1 counterpart's contract.
Loaded after `career-motion-live.js`; its last line, `MachineWheel.install()`,
replaces the three V1 globals, so **edit the V2 functions here, not the V1
bodies** in `06-presentation.js`/`career-motion-live.js` (those remain only
so `wheel-v2-lab.html` can switch back to compare). Tuning lives in
`MACHINE_WHEEL_CONFIG`; sounds are `Sound.wheel*` in the `Sound` module.
`machineWheelBack()` turns the same drum the other way (profile `back`)
for the back paths — Career->Home, Back to Events and Leave table call it
through `rollBackTo()` in `07-ui-wiring.js`.

## `js/table-intro.js` + `css/table-intro.css` — Table Intro (live)

"The machine powers up": the beat between arriving at a table and its first
deal. Stepped lights; the event's own ticket (built from the Hub's
`.ch2-card`/`.ch2-paper` venue styling) slides in from the right, holds,
stamps ENTRY PAID, and leaves left; a clockwise seat roll call; the bank
loads whole chip stacks through the hatch; pot tray + deck drop.
Presentation only. `TableIntro.install()` wraps the table entry points
(`startCareerEvent`, `continueCareerEvent`, `startCareerCashSession`,
`startSinglePlayerRun`, `continueTable`, `startGame`) to arm it and
`startNewHand` to play it before the first deal; it also absorbs the
Machine Wheel's `careerTableCallout` title flash. Tuning lives in
`TABLE_INTRO_CONFIG`.

## `js/ticket-feed.js` + `css/ticket-feed.css` — Career buy-in feed (live)

Replaces the Hub's buy-in animation through the `careerTicketFeed` hook in
`career-hub-live.js` (absent the file, the old feed runs unchanged). The
ticket lifts and narrows to the intake mouth, is ratcheted over the plate's
lip and into the mouth, then the cabinet shudders and grinds while the
bankroll counts down; the ticket never returns to the rack — it reappears on the felt via the Table Intro. It
receives the Hub's own `charge`/`depart` steps and owns no money.

Both pairs are loaded by `index.html` (after `machine-wheel.js`) and
precached by `sw.js`. `intro-lab.html` runs the real game sandboxed with
NEW/OLD switches for each, for future tuning.

## `js/home-boot.js` + `css/home-boot.css` — Home Boot (live)

"The cabinet switches on": ~1.6s on the main menu, once per real page load
(never on returning to the menu). Mains relay clunk, self-test lines in the
top readout, marquee letters of the title catch one by one, the stripe runs
out, the House Faces drop into their tray, stats spin, control-bay buttons light, then
DEALER READY. Presentation only. The dark "armed" state is set by a small
inline script right after `#home` in `index.html` (so the lit menu never
flashes first, with a 4s fail-safe); a tap skips and its click is
swallowed; Reduced Motion skips it. Sounds are gated by `Sound.audible()`
because a cold launch has no user gesture (silent on iOS until the first
tap). Tuning lives in `HOME_BOOT_CONFIG`; `boot-lab.html` replays it with
speed and sound switches. The old title-glass tap toy was removed with this
pass.

## `js/home-cast.js` — House Faces drawer (live)

The four title-screen portraits (`initHeroFaces`, called from `wireUI`).
Each launch deals them four distinct temperaments from
`HOME_CAST_TEMPERS` (hothead, showman, schemer, nervy, thinker, deadpan):
a rest mood, a three-flash burst, an idle pool and a reaction to a
neighbour's flare. Sparse, silent idle life; tapping a face flares it.
The Home Boot drops the faces in and calls `HeroCast.arrive(i)` on each
landing. Decorative only — not the table mood system.

## `js/finishes.js` + `css/finishes.css` — Finishes menu (live)

Settings → Finishes: a page inside the Settings sheet that swaps each
Pattern Book set (CRT look — the game recipe or a CRT Lab preset — and
button press) live, on this device only (`felt.finishes`, applied before
first paint by the inline script at the top of `index.html`, which also
keeps the game's recipe as `window.CRT_RECIPE`). `FINISHES_MENU` switches
it off.
See `docs/ui/PATTERN_BOOK.md`.

## `js/press-feel.js` + `css/press-feel.css` — press feel for every button (live)

Now covers every button family, not just the big ones: one thunk scaled
big / standard / small (sizes and classes in `SIZES`, tokens in the CSS).
The original notes below still describe the big cartridges.


Every `.pc-button-primary` on the menu and the Career Hub: the face sinks,
lamps flare, the casing knocks and the clunk plays on finger-DOWN; on
release the face springs back in pixel steps. A key the game holds down
(`career-entry-pressed`, `pc-launch-clunk`) is left held. Click handlers
that played the clunk themselves call `pressFeelSounded(button)` first so
it never plays twice. The big-button geometry rule (body as tall as the
face, 7px lower; cradle padded 9px/23px for an even 7px rim) lives with
`.pc-primary-cradle` in `css/04-overlays-and-modes.css`.

## `css/crt.css` + `js/crt.js` — the CRT component (live) and `pattern-book.html`

Every CRT screen in the game is one component. `css/crt.css` (the last
stylesheet) owns everything visual: glass, the text roles (line / figure /
caption / cells), ink by meaning, and every effect as a `data-crt-*` dial;
the signed-off recipe is those dials on `<html>` in `index.html`.
`js/crt.js` watches every `.crt` and plays the change effect (and ghost of
the old text) whenever anything rewrites it; `data-crt-quiet` opts out
(number wheels, stage reveals). Layout (size, padding, grid) stays in each
screen's own stylesheet; nothing else may style a CRT's glass or text —
`validation/pattern-book-checks.js` reads every live stylesheet for that,
and `validation/tools/crt-consistency.js` compares every part as drawn.
`crt-lab.html` (+ `js/crt-lab.js`) is the Lab it was chosen in: every game
CRT with five presets (`CRT.PRESETS`) and all dials. `pattern-book.html` is
the visual library (isolated like the Labs). Rules and the sign-off record:
`docs/ui/PATTERN_BOOK.md`.

## `js/08-dev-mode.js` (~1,140 lines)

The DEV panel. Every control drives real production functions
(`applyAction`, `resolveEliminations`, etc.) rather than a parallel fake
path — see the file's own header comment. Entirely absent from the DOM when
`DEV_MODE` is false. Useful for reaching a specific game state
(forced all-ins, rigged deals, Career bankroll presets) without playing
there manually.

## Labs vs. production — do not confuse the two

Files matching `*-lab.html`, `*-lab.js`, `*-lab.css` (`career-lab`,
`career-hub-v2-lab`, `ticket-lab`, `card-flight-options`, `card-turn-lab`,
`chip-motion-lab`, `chip-lab`, `chip-throw-lab`, `design-lab`, `result-stage-lab`, `showdown-rail-lab`, `crt-lab`,
`wheel-v2-lab`, `intro-lab`, `boot-lab`, `slot-lab`)
are **isolated visual references and prototyping sandboxes**. Several are
committed permanently as durable references even after their feature
shipped. Rules:

- A production file (`index.html`, `sw.js`) never links to a Lab file.
  Several validation suites assert this explicitly (grep for
  "production-isolation audit" in `validation/*.js`).
- A Lab may load real production systems (e.g. `Sound` from
  `02-support-systems.js`) to audition them accurately, but never writes to
  `localStorage`, `felt.career`, or any real save.
- `css/career-hub-v2-lab.css` is the one exception worth knowing:
  production's live Career Hub (`career-hub-live.js`) **also** loads this
  stylesheet — it's the real production ticket/card CSS, not lab-only,
  despite the filename. Don't assume `*-lab.css` is always inert.
- If you're not sure whether a file is live, check `index.html`'s
  `<script>`/`<link>` tags and `sw.js`'s `APP_SHELL` array — if it's not
  listed there, it's not shipped to players.

## `validation/*.js`

One focused check suite per feature area, run with plain `node`, no test
framework. `node validation/<name>.js` prints pass/fail per assertion and a
final count. Run the relevant suite(s) before and after any change — see
`docs/career/STATUS.md` for the current Career-specific set and
`validation/tools/README.md` for a browser/touch-emulation harness you can
reuse instead of writing a new Playwright script from scratch each time.

## `docs/`

- `docs/career/STATUS.md` — **read first** for any Career task. Current
  build, current state, immediate next task.
- `docs/career/CAREER_DESIGN.md` — product rules and economy. Read only
  when the task touches catalogue, pricing, unlock rules, or other product
  decisions.
- `docs/career/BUILD_PLAN.md` — the phase sequence and what each phase's
  scope/exit condition is. Read only when the task is about sequencing or
  which phase something belongs to.
- `docs/career/HISTORY.md` — dated archive of every completed milestone.
  Reference only, never a default read.
- `docs/ui/VISUAL_AUDIT.md` — 2026-09-25 visual/motion/glitch audit of the
  whole game: findings F1–F21 with causes, a motion map of every screen
  change, level-up ideas and a phased plan. Proposals, not approvals.
- `docs/ui/CHIP_PLAN.md` — the chip upgrade plan (bank, bet spots + sweep,
  pot, payouts, feel), the owner's answers so far, and the options built
  in `chip-lab.html` (+ `js/chip-lab.js`, `css/chip-lab.css`: the real
  table with switchable chip values, opponent chips and bank styles).
  `chip-throw-lab.html` (+ `js/chip-throw-lab.js`, `css/chip-throw-lab.css`)
  is its companion for how chips travel: a chip physics world (every
  chip on the felt is a body: gravity arcs, flips through code-drawn pixel
  frames, bounces, knock-offs, mess then tidy; the rail and the cards are
  solid; throws vary by bet size; gold coin art by default). Since v10
  the owner's settled mix is built in, the drawer keeps only the sound
  set, coins per bet and speed, and PLAY HAND plays a real hand on it.
- `docs/scoring/SCORING_SPEC.md` — authoritative scoring/award rules for
  both Career and Single Player.
- `docs/ui/handover/` — earlier UI handover notes; a `python3 -m http.server`
  one-liner for local previews lives in its `README.md`.
