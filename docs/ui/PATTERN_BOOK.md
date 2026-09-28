# The Pattern Book

The visual library for The Table. It decides how every repeated part of the
machine looks, moves and sounds, so the same kind of part never appears with
a slightly different finish on two screens.

- **Live page:** `pattern-book.html` (isolated like the `*-lab.html` pages;
  production never links to it). Its CRT section runs on the real
  `css/crt.css` and `js/crt.js` with the game's recipe.
- **Labs:** `crt-lab.html`, every game CRT with presets and dials.
- **Checks:** `node validation/pattern-book-checks.js` (reads every live
  stylesheet) and `node validation/tools/crt-consistency.js` (compares
  every CRT part as the browser draws it; needs the local server).

## The rule

**Same job, same finish.** Parts are grouped by the job they do (the one
main action on a screen, a small corner key, a CRT). Within a job, the
*finish* is identical everywhere: material, colour, bevel, depth, glow,
motion, press feel and sound. The *content* stays free: what it says,
how many lines, its width, and where it sits on the screen.

Different jobs keep different looks. Variety between jobs is intended;
drift within a job is not.

## Building something new

1. Look here first. If a part for that job exists, use its class. Don't
   restyle its finish locally.
2. If the job is new, or no existing finish fits, don't invent one in place.
   Propose 2–3 candidates shown on the real screens, get sign-off, then add
   the part here (a shared class, a section in `pattern-book.html`, a check
   in `validation/pattern-book-checks.js`) **before** using it in the game.
3. Changing an approved finish is a new sign-off, recorded below.

## Trying other looks: Finishes

Because each family is one shared set, trying a different look is one
switch. **Settings → Finishes** (`js/finishes.js`, a page inside the
Settings sheet) lists each set with its options; a tap applies it
everywhere at once, in the real game. Choices stay on that device only
(`localStorage` key `felt.finishes`); everyone else gets the defaults.

- The first option of every set is the signed-off default (blank id).
- The CRT look is the game's recipe or a CRT Lab preset (`CRT.PRESETS`);
  picking one rewrites the `data-crt-*` dials on `<html>`. The press is a
  named value of `data-finish-press`, whose tokens live in
  `css/press-feel.css`. No screen is touched.
- To add an option: a preset in `CRT.PRESETS` (CRT) or an entry in
  `FINISH_SETS` plus its token block (press). The check fails if an option
  has nothing behind it.
- To make an option the new default: move its tokens into the set's base
  tokens, record the sign-off below, and drop the option.
- `FINISHES_MENU = false` hides the menu and returns devices to defaults.

## How sign-off works

Each family is shown as a "Now" row (every real instance, cropped in the
game) and option rows (the same instances restyled in the running game with
one shared finish). The owner picks a row; it applies to all of them.
Motion and sound are signed off from live demos, never stills.

## Sign-off record, 24 September 2026

| Family | Approved | Status |
|---|---|---|
| CRT screens | Rebuilt as one component and chosen in the CRT Lab: **Pulp (tweaked)** · glass dark · glow 1 · scanlines 4 · RGB split 0 · grain 4 · curve 0 · flicker 4 · rolling bar 1 · VHS tears 4 · ghosting 2 · change: channel · ink: mono | **Live** v0.40.0 |
| Hero button | **A** Machine cartridge (Home: Career) | Approved, next |
| Standard button | **B** Dark tile (Home: Quick Deal) | Approved, next |
| Danger button | **D3** Dark key, coral print, coral inner edge | Approved, next |
| Small key | **B** Cream (Career keys), one square size for icon keys | Approved, next |
| Choice row | **A** Small bold labels (Settings) | Approved, next |
| Screen header | **A** Dark plate, cream title (Custom Game) | Approved, next |
| On/off switch, stepper | Only one version exists; approved as is | Settled |
| FOLD / CHECK / CALL / RAISE | Kept as their own locked family | Settled |
| Press feel | One heavy thunk on every button, scaled by size (big / standard / small), FOLD/CHECK/CALL/RAISE included | **Live** v0.39.7 |
| Number wheels, sound | Round 2, from live demos | To do |
| Dashboard V2 | The owner's order from the order form (25 September 2026); see **Dashboard V2** below | Release 1 of 4 **live** v0.40.2 (frame, bays, rim light); layout, raise and behaviours next |

Approved-but-not-migrated families have reference captures in
`docs/ui/pattern-book/`. Each moves into a shared class, one family per
release, with before/after screenshots.

## CRT screens (live)

Any screen showing information that changes while the machine runs. Every
one is the same component, `css/crt.css` + `js/crt.js`. It was rebuilt from
scratch rather than layered on the older per-screen recipes: those were
stripped of every glass and text declaration, keeping only each screen's
layout.

**Anatomy.** A CRT can only be built from these parts:

| Part | Rule | Class |
|---|---|---|
| Glass | The screen itself. Its layout (size, padding, grid, flex) is the screen's own; everything visual is the component's. | `.crt` |
| Line | Status text. Plain text inside a CRT is a Line: 7px, regular, one spacing. Narrow phones step every line down together (6.5px ≤389px, 5px ≤350px). | `.crt-line` or none |
| Figure | A number or a result word: 13px, or 17px for the big ones. | `.crt-figure`, `.crt-figure--lg` |
| Caption | A small label: 7px, dimmer ink. | `.crt-caption` |
| Cells | Side-by-side sections, one thin rule between them; no inner panels. | `.crt-cell` |
| Lamp, meter, cards | An indicator lamp, a progress meter, playing cards (keep their own inks). | `.crt-lamp`, `.crt-meter`, `.crt-cards` |
| Ink | By meaning on the screen: none (info), `live`, `money`, `danger`; `.crt-danger` on a single element. Strong hands and money reels read as money; the negative results tone inks the score and statement as danger. The recipe's ink scheme can fold these together (the game uses mono). | `data-ink` |

**Look.** Twelve dials, set once on `<html>` in `index.html` (the recipe
above): tint, glow (always in em), scanlines, RGB split, grain, curve,
flicker, rolling bar, VHS tears, ghosting, change effect, ink scheme. The
component turns them into tokens; no screen sets any of them.

**Changes.** `js/crt.js` watches every `.crt`. Whoever rewrites a screen
(the table's `paintCRT`, the Home Boot, Career's record pages, the results
stat bank), the recipe's change effect plays and the old text ghosts out.
Rapid runs settle into one change; first text is never a change;
`data-crt-quiet` opts out a screen whose changes are a number wheel or its
own reveal (bet, raise, results score and instruments, Home stats). Reduced
Motion: text just swaps.

**Rules.**
- To add a CRT: put `crt` on the element, give its text the roles above,
  and set `data-ink` if it isn't ordinary info. Layout in your own CSS.
- Never set a CRT's colour, font, glow, background, border or animation
  anywhere but `css/crt.css`. `validation/pattern-book-checks.js` reads
  every live stylesheet and fails on it; `validation/tools/crt-consistency.js`
  opens every screen and fails if two same parts are drawn differently.
- Mechanical-number reels inside a CRT keep their own geometry (Round 2),
  and take the CRT's ink and glow.

In the game: Home readout and stats; Career record and ticket slot; table
hand readout, turn banner, bet and raise readouts; results-stage score,
instruments, stat bank, trophy case and run progress.

## Press feel (live)

Every button presses the same way: the heavy thunk from the big Career /
Buy In keys, scaled by the key's mass. Owner: `js/press-feel.js` +
`css/press-feel.css`.

| Size | Buttons | Sink | Bounce back | Sound |
|---|---|---|---|---|
| Big | `.pc-button-primary`, `.btn-primary`, FOLD/CHECK/CALL/RAISE, Award Pot, Quick Resolve, `.wide-btn` | 5px | overshoot 3, dip 2, lift 1, settle (300ms) | `allin` clunk (+ casing knock on the cartridges) |
| Standard | `.pc-button-secondary`, `.btn-secondary`, choice rows, quick bets, Career secondary keys | 3px | overshoot 2, dip 1, settle (240ms) | `thunk` |
| Small | `.icon-btn`, `.ch2-key`, `.table-save`, steppers | 2px | overshoot 1, settle (170ms) | `key` |

- The press happens on finger-down; the bounce plays on release, in pixel
  steps. A key the game holds down (the Career launch) stays down.
- The table actions keep their own per-action press sounds (fold, check,
  raise…); they take the motion only. Their rest position is 1px proud, so
  their travel is measured from there (`--pf-rest`).
- A click handler that used to play its own press sound calls
  `pressFeelSounded(button)` first.
- New buttons: use one of the listed classes and the press comes free. A
  button family that isn't listed gets no press until it's added to `SIZES`
  in `press-feel.js` (and this table).
- Finishes options: Thunk (default), Heavy, Light, Original (each button's
  pre-book press, for comparison).
- Reduced Motion: the face still sinks while held, but doesn't bounce.

## Dashboard V2 (release 1 live, the rest lab-built)

The player's dashboard, ordered by the owner on the Dashboard V2 order form
(`dashboard-order-lab.html`, rules in `docs/ui/DASHBOARD_V2_RULES.md`). It
moves into the game one part per release, each as a shared class with a
section in `pattern-book.html` and a check in
`validation/pattern-book-checks.js`:

1. **Frame, bays, rim light: live v0.40.2.** `css/dashboard.css` +
   `js/dashboard.js`; see *Live parts* below.
2. Layout and parts (the one grid, fixed screen, full-width stack drum,
   pucks, small bet drum, V1 tray, cradle key bay): lab only.
3. The raise (barrel, fader, hold-to-charge ALL IN): lab only.
4. Behaviours (knock to check; card peek as a Settings option, off by
   default): lab only.

Lab-only parts are built in `css/dashboard-order.css` and
`js/dashboard-order.js` behind `data-do-*` attributes; the lab runs on the
real game, so it already shows the live frame. Universal parts inside the
dashboard (CRT glass, FOLD / CHECK / CALL / RAISE, the reel counters, cream
small keys, press feel) keep their own entries above and are used as they
are.

### Live parts

| Part | Use it | Owner |
|---|---|---|
| Frame | `.dash-frame` on `#your-seat-dock` and `.dash-frame-base` on `#action-area`. One shell on the dock's `::before` runs down behind the key bay (`--dash-drop`), so the frame is one piece. Band 8px, gap 5px, 18px corners; the key bay keeps the home-indicator clearance (`--dash-foot`). Narrow phones (under 390px) only move the frame closer to the edge and give back V1's case padding, so keys and the stack drum keep their V1 width. | `css/dashboard.css` |
| Bay | `.dash-bay` on any dashboard bay (today the bank and the right bay). | same |
| Rim light | `data-rim` on `.dash-frame`: `turn` (`--pc-lamp-amber`, steady), `allin` (`--danger`, stepped pulse; you all in, or facing an all-in bet), `win` (`--pc-lamp-amber-hi`, 1.7s), `bust` (flickers out, then dark until the next table). Priority bust > win > all in > turn > dark. Every switch-on steps in (`.dash-relay`) with `Sound.wheelRelay`. It is drawn under the case (`z-index:-1`, over the frame shell), so the cards stay in front of it even while the case is animated; its glow onto the case is an inset glow on `#hud-frame` (v0.43.0; before, a filter, transform or fade on the case put the rim across the cards). The win shake moves the whole machine (`.dash-shake`), never the case alone. | `js/dashboard.js` (`DashRim`); `celebrateWinnerSeat()` calls `DashRim.win()` |
| Reduced Motion | No relay flicker, pulse or shake; the win is steady warm light, bust is simply dark. | `css/dashboard.css` |

Before/after at 430 × 932, and each rim state:
`docs/ui/dashboard-v2/release-1-before-after-lab-430.png`,
`docs/ui/dashboard-v2/release-1-rim-states-430.png`.

### The order

| Part | Order | The finish |
|---|---|---|
| Frame (live) | **SMOOTH** | The dashboard is its own instrument, lifted off the table by a dark gap: one moulded shell behind the whole console (top, sides and bottom as one rounded piece, so the bevels follow the corners with no joins), 2px ink edge, two-step soft bevel, hard shadow under it. The case inside is one checker surface; a dark groove seams the instruments from the key bay. |
| Recess (live) | **HARD SUNK** | Every bay: near-black, 2px ink edge, a hard 5px shadow along the top, a lit lip below. |
| Rim light (live) | **CHANNEL**, **BOLD** | A groove running round the frame, dark at rest. It is the machine's one state light: your turn amber (steady), all in red (slow pulse), a win warm (brief), bust flickers out and stays dark. Every change switches on in steps with a relay click. It never sits over the cards. |
| Layout | fixed | The bank (left) and the blinds + bet (right) mirror each other; the screen sits between them under the cards. The three share a top line and a bottom line. The stack drum runs the full width of the dashboard under them, with no label. |
| Screen | fixed | One CRT, a fixed size whatever it says: a fixed hand line on top (two short lines on narrow phones), the turn lines below. It only changes size when the mode changes (the result face). |
| Card tray | **V1** | Today's lip. The cards stand up out of the machine; the tray and the screen never touch. New tray options are a later pass. |
| Blinds | **PUCKS** | Round tokens, cream and lifted when the blind is yours. |
| Bet this hand | **SMALL DRUM** | A small reel counter (the stack's own part, gold frame) under the blinds in the right bay, with a printed THIS HAND caption. |
| Button bay | **CRADLE** | One shallow recessed cradle; the key tops sit level inside its rim and nothing overlaps it. |
| Raise | **BARREL**, **FADER** | RAISE rolls the instrument panel over, in steps with an overshoot and a lock, to the sizing face; the drum's next face shows edge-on inside its top. The face: printed title, cream cancel key, the raise drum in a gold frame, a chunky cream fader cap in a deep slot that clicks at each notch, cream quick keys, the hold-to-charge ALL IN key. Every change rolls the drum. (The animation gets its own pass.) |
| Behaviours | **ON** | Knock to check (double-tap the case; refused with a buzz facing a bet; the whole machine jolts, never the case alone), card peek (a setting, off by default in the game), hold to charge ALL IN. |

Parked for later passes: the raise animation, card tray options, the
theatre pass (ALL IN moment, bust, win), and the chip bank and chips.

## Enemy Cards V2 (live v0.41.0)

The opponents' seat cards, from the owner's order on the Enemy Cards order
form (`enemy-card-lab.html`, round 3, 27 September 2026). One release: the
parts are added to each opponent's seat by `js/enemy-cards.js` (`.ec-seat`)
and styled by `css/enemy-cards.css`; `render()` calls `EnemyCards.paint()`
and the coin table (`js/coin-table.js`) asks `EnemyCards` where coins leave
from and land. Presentation only. Universal parts inside (the CRT, the
stack reel, cards, the face) keep their own entries and are used as they
are; the readout is a `.crt` with `data-ink`, never styled locally.

| Part | Order | The finish |
|---|---|---|
| Cabinet | **PAINTED** | The case takes a wash of the face's colour (`--ec-own`, 30% over the machine case), coloured rivets in the corners, a stripe of the colour under the name. A win keeps V1's warm case. |
| Name | **CHARACTER** | The character's name (`PERSONALITIES_ALL[].name`: Nigel, Lucy, Tony, Mavis, Steve, Roxy, Harry, Bruno; their style is `.style`), a size up on the plate (12px; 11px at 5–6 opponents). The table, log, banner, results and Career tickets use the same name. |
| Readout | **TWO LINE + COUNT** | A small `.crt` in place of the action slot: the action on top, the amount under it, counting up like a till. Ink from the component: money for chips going in, danger for all in and out. |
| Hole cards | **TUCKED UNDER** | Out of the box, behind the cabinet, a strip showing under the bottom edge. Dealt to just below the card, in plain sight, then slid up under it; at showdown they slide right out, a size up (×1.38); on a fold they slide in and are gone. |
| Coin cup | **CUP** | A coin-return cup sunk into the base; the seat's coins leave from it and come home to it, and it glows while they do. |
| Rim light | **OWN COLOUR**, reacts to **EVERYTHING** | A lamp tube laid over the cabinet's own border (no extra footprint), glowing faintly in their colour at rest. Their turn: their colour, bright; thinking: it breathes; a bet, call or raise: one flash; all in: red pulse; a win: warm (1.4s); a fold: dark; out: flickers out. Switch-ons step in with the dashboard's relay (its keyframes). |
| Next to act | **RIM PRE-LIGHT** | The next seat's rim lights dimly in their colour. |
| Bet square | **FAINT** | A square of slightly darker felt right under each seat (centred on the card, a fixed gap below the tucked cards) and centred above your cards; the bets land in it. Measured from layout, so a knock, a deal or a showdown never moves it. |
| Cabinet moves | **KNOCK + SHUDDER** | A check: the cabinet taps the table twice, with a knock. An all in: it shudders once. |
| Face size, stack gauge, blinds | **TODAY**, **NONE**, **ON THE FACE** | Unchanged. |
| Reduced Motion | | No blips, pulses, flicker, knocks, shudders or slides: states simply change. |

Not taken: the player's file (every version failed to read at card size),
the stack gauge, blind pucks on the felt. The lab still offers every
option on V1 cards, with the shipped files stripped from its copy.


## K.O. + game over (live v0.43.0)

The owner's order from the K.O. order form (`ko-lab.html`, round 3,
27 September 2026; `docs/ui/KO_PLAN.md`). `js/knockout.js` replaces the
elimination presentation (`playElimination`/`playEliminationGroup`) and
wraps `presentResultStage` for a bust; `css/knockout.css` styles it. The
eject is still the game's own portrait physics. Presentation only.
Universal parts inside (faces, the Enemy Cards readout, cards, buttons, the
stack reels) are used as they are; flying copies inline their computed
style so they look exactly like the part they left.

| Part | Order | The finish |
|---|---|---|
| Build-up | **REF COUNT** | 3 · 2 · 1 on the seat's readout (danger ink) with a boxing bell each, the rim red, the face more scared each count; the bell rings out three times on the K.O. |
| Stamp | **BIG K.O.!** | A big pixel K.O.! (`.kofx-stamp`, the header font, gold with a hard ink outline) slams onto the felt; the blast knocks it away. DOUBLE / TRIPLE K.O.!; someone else's knockout is a grey OUT!. |
| Blast | **+ DEBRIS**, **ONE BY ONE** | A one-frame flash, a stepped screen shake, bits of the socket in the face's colour. Two or three fire about half a second apart, each blast bigger; the ones waiting rattle. |
| The others | **FLINCH** | Every other opponent flinches and pulls a scared face. |
| Flight | **LIGHT** trail, **REACTS**, **SPARKS**, **SOLID** | About three stepped afterimages; a new face on every hit; sparks off every contact; the other cabinets are solid (a seat that's hit rattles and pulls a face). Exits off screen; no slow motion. |
| Empty socket | **SMOKE** | Pixel smoke curls out of it for a few seconds, the odd spark. |
| The killer | **GLOATS** | A soft round spotlight on whoever busted you, their rim lit warm, a smug face and a two-word gloat on their readout. |
| The hit | **THUNKS** | The dashboard is hit twice from below; the screens glitch. |
| Damage | **CHAIN REACTION**, **RANDOM**, **1, 2 OR 3** buttons, cards **POP OUT** | A random handful (one to four) of: a screen floods with static, switches itself off or loses its glass; the stack drums spin wild and jam red, some popping out; the SB/BB bulbs pop; the rim shorts and dies; the settings key pops off; a bracket snaps and the console hangs crooked. Plus one to three buttons shot off (the holes smoke) and your cards. Everything is put back for the next run. |
| Lights out | **CRT OR RUBBLE**, pace **LONG** | A coin toss: the screen switches off like an old TV (line, dot, black; the result stage switches on out of the black, the dashboard repaired) or the machine sputters and dies where it stands. |
| Reduced Motion | | The game's own instant end state; no game-over beat. |

Not taken: spotlight on the K.O., slow motion, the glass exit, NO SIGNAL,
quips, TILT. The lab still offers every option, with the shipped files
stripped from its copy (`css/ko-fx.css`, `js/ko-fx.js`).

## Showdown (live v0.42.0)

The end of a hand, from the owner's order on the Showdown order form
(`showdown-lab.html`, rounds 1–5, 27 September 2026). The beats are
`js/showdown.js`, styled by `css/showdown.css`; the pot, share and
settlement code is the production code verbatim
(`validation/showdown-checks.js`). Presentation only. It adds no new
screen, key or plate finish: every part is a shared part used as it is.

| Part | Order | The finish |
|---|---|---|
| The lock | **DIP + SHOWDOWN FACE** | The house lights dip for a beat (a panel over the felt, in the overlay); the console turns to the AWARD POT face, lit and locked. No chasing casino lights. |
| Win chance | **METER** (a setting, off by default) | A `.crt` (`data-ink="live"`, quiet) under the pot plate: a bar in each player's colour and `.crt-caption` keys. Never styled locally. |
| Reveal | **ONE BY ONE** | Their cards slide right out of the cabinet in front of its base shadow (the rim light never covers them); losing hands stay readable, beaten cards dim. |
| The verdict | **RAIL NAMEPLATE** | The winning hand's name sits on the rail's top edge (`.showdown-hand-stamp`), never under the tray's coins. Kicker and split plates take the rail stamp's finish. |
| Pots | **A PLATE A POT** | Side pots each get a plate: the pot plate itself (`.pot-chip`), a size down. |
| Your loss | **DIM** | The dashboard dims with a low thunk; your hand readout takes the CRT's own `CRT.glitch()`. |
| The smash | **THE COOK** (a setting) | Holding AWARD POT heats the tray's well (a stepped heat bed and glow, ember by default); on release the coins fire out in real time, bounce off the frame, cabinets and felt, settle as a mess on the table, then pick themselves up into your bank. The key always reads AWARD POT: a tap is the full show, a hold goes wilder. |

Settings → Showdown uses the sheet's own segmented keys and switch: the
smash (monster pots / big pots / every win / off), force, bounces, heat,
into your bank, win chance and when AWARD POT waits.

Reduced Motion: no dip, peek, lift, hum or heat flash, and the beats'
waits are cut.

## Action drum (live v0.48.0)

The key bay's sides turn on one drum, from the owner's order on the Action
Drum Lab (`action-drum-lab.html`, rounds 1–3, 28 September 2026;
`docs/ui/ACTION_DRUM_PLAN.md`). `js/action-drum.js`, styled by
`css/action-drum.css`. It replaces the two nested CSS flips, whose hidden
faces iPhone Safari drew behind the live keys.

| Part | Order | The finish |
|---|---|---|
| The drum | **DRUM · 4 SIDES**, **ALWAYS DOWN** | FOLD / CHECK / RAISE, QUICK RESOLVE, AWARD POT (with SHOW) and the results keys are sides of one four-sided drum; each change rolls it down one side. |
| The turn | **MEDIUM**, **CLUNK**, **CHUNKY · 20 FPS** | About a third of a second, stepped like the rest of the machine; it runs a little past and knocks back. No taps while it turns. Ticks and a catch (`Sound.wheelTooth`, `Sound.wheelCatch`). |
| Shading, panels | **ON**, **WHILE IT TURNS** | Each side darkens as it turns away; a painted panel backs every side only while it turns, so at rest the keys sit in the well as before. |
| The housing | bezel, **WINDOW WHILE IT TURNS** | The bay is a dark well with a fixed bezel over the drum (ink edge, a thin brass ring); the drum shows only through its opening, with dark lips top and bottom while it turns. The bay is 10px taller in portrait (101px; 94px on short phones), the room going between the instruments and the bezel. |
| The deal side (v0.48.1) | fixed | NEXT HAND, REBUY and NEW TABLE are a side of the drum too, not buttons floating over the bay: moved onto it (same ids and handlers), in the console's key (`.btn-award-console`; NEW TABLE beside REBUY takes `.results-secondary`). The drum rolls to it whenever the game unhides one, and holds a pressed key on the side as it rolls away. |
| The key line | fixed | Every side's keys take the FOLD / CHECK / RAISE row's measured top and height, so no side lands higher or lower. |
| The rim's glow | fixed | The lit rim's inner glow runs on round the bay (sides and bottom) in the same lamp, so it no longer stops at the join. |
| The award key (v0.50.0) | **VELVET + GOLD**, **COLLECT**, **PRINTED**, **A FLASH**, **SPARKS + CLACK**, **MORE SHINE**, **QUIET · PAY HARRY** | The shared AWARD POT key (`.btn-award-console`) in a state for whose pot it is (`data-ak`). Yours (`mine`): the machine's burgundy velvet with gold letters and a gold rim, reading COLLECT · 1,500 (SPLIT when you share it); a flash as the drum lands it; gold sparks off its edges and the counter's clack when pressed; a big or monster pot adds a gold ring round it. Someone else's (`theirs`): the quiet case key, PAY HARRY · 888. The game's own words stay as its `aria-label`. No chasing lights. Learns whose pot it is by wrapping `showHudResultConsole`; presentation only. `js/award-key.js`, `css/award-key.css`. |
| Knock to check | **ON** (Dashboard V2 order) | Double-tap the dashboard case to check: two thuds, a ring, the whole machine jolts. Facing a bet it refuses with a buzz and CAN'T KNOCK. Not the bank, your cards or a key. `js/knock-check.js`, `css/knock-check.css`. |

Rules for anyone touching it:

- Never hide a side with `backface-visibility` or `preserve-3d`: each side
  is projected on its own and, at rest, every side but the live one is
  `visibility:hidden` with no transform.
- The game drives it only through the `.flipped` classes on
  `#console-flip` and `#actions-flip`, as before; no ids or handlers move.
- Reduced Motion: an instant swap, no jolt.

## Dealer deck (live v0.45.0)

The dealer's deck, from the owner's order on the Deck Lab (`deck-lab.html`,
round 4, 27 September 2026; `docs/ui/DEALER_PLAN.md`). `js/dealer-deck.js`,
styled by `css/dealer-deck.css`. Presentation only
(`validation/dealer-deck-checks.js`).

| Part | Order | The finish |
|---|---|---|
| The deck | **A PLAIN DECK**, bottom left (a setting) | Made of the same card as the ones dealt off it: the top card and, under it, a few more of the same card two pixels apart (each shows a line of its trim, then ink), thinner as the deck runs down. A shadow on the felt; no tray, counter or burn pile. |
| Card backs | **HOUSE CREST** (a setting, ten backs) | One recipe for every face-down card (the deck, the flights, their cards, yours before they turn): a field, a trim inside the 2px ink outline, an optional frame line and centre diamond. Backs only set its tokens. House crest, gold lattice, classic red, velvet stripe, midnight, emerald crest, casino check, sunburst, ivory, harlequin; table green (the old back) stays as a choice. |
| The shuffle | **FULL**, every hand | By hand: split into two halves, riffle a card at a time from alternate halves, the bridge (arch up, cascade down), squared up with two taps. |
| Off the deck | **SLIDES OFF FIRST**, the deck knocks | The top card slides off with a little drag, then the approved Dealer Flick; a felt puff where it lands. |
| Burns | **TUCK UNDER** | Before the flop, turn and river the top card slides off to the side and tucks under the deck. Nothing is left out; the game's deck is untouched. |
| The board | **STACK + SPREAD**, turns as it fans; **THREE TAPS** | The flop lands stacked on the first spot, fans out and turns as it fans. The turn and river come after three taps on the deck. |
| The muck | **ALL AT ONCE** | The cards fly back onto the deck, which thickens as they land, then it is squared up. |

Settings → The deck: the card back (a row of real cards, the sheet's
segmented keys laid out as a grid) and the side (bottom left / bottom
right).

Reduced Motion: the shipped deal, with no shuffle, burn or taps.

## Card holder (live v0.49.0)

The lip your two cards sit in, from the owner's order on the Card Holder
Lab (`card-holder-lab.html`, round 2, 28 September 2026;
`docs/ui/CARD_HOLDER_PLAN.md`). `css/card-holder.css` +
`js/card-holder.js`. Presentation only.

| Part | Order | The finish |
|---|---|---|
| Position | **10PX OF AIR**, the holder rises | The lip sits 10px clear of the hand-name screen below it on every phone (measured, not guessed); the holder and cards move up the dashboard, the screens stay put. Cards hang over the dashboard edge as before; width as before. |
| The lip | **BRASS** (a setting: brass / classic) | Brass: the instrument gold (`--pc-lamp-amber` family), a lit top edge, a dark underside, a screw at each end, 2px ink outline and a hard 3px shadow onto the case. Classic: today's case-coloured lip, in the same position. |
| The seat | **SEAT SHADOW** | A deeper slot behind the cards, and a soft shade (20% to nothing over 14px) rising up the card faces from the lip. The cards' own drop shadow is off while they sit in it: the lip hides their feet. |

Settings → The deck → Card holder: the sheet's segmented keys, a small lip
drawn in each.

## Deal styles + the 2.5D card (live v0.51.0)

How cards fly off the deck, from the owner's order on the Deal Style Lab
(`deal-style-lab.html`, round 5, 28 September 2026;
`docs/ui/DEAL_STYLES_PLAN.md`). `js/deal-styles.js` + `css/deal-styles.css`
on the deck's flights (`js/dealer-deck.js`). Presentation only.

| Part | Order | The finish |
|---|---|---|
| The card in flight | **2.5D SPRITE** (the deck's `sprite:'on'`) | Like the chips: the flat pixel card holds a pose stepped at 14 frames a second while it glides. Banking narrows and slants it with its far side in hard-stepped shade; tipping shortens it a little with a lit band toward the lamp; spins snap to 15°; it grows as it rises. Never tips far enough to show its thickness, never over. A pixel shadow on the felt drifts away as it rises. |
| Turning over | **SQUASH FLIP** (crisp since v0.51.1) | Turns about its upright axis in hard frames, quick (about 25 a second; 400ms for a board card): it narrows, lifts a little with its shadow left on the felt, the edge going away drops into stepped shade while the near edge catches the lamp; edge-on, the sides swap and it comes round with the shade on the other edge. The board, the showdown, your cards in the air. |
| Shuffle, flop spread | **LEAN** | The same stepped lean as the cards split, riffle, bridge and fan out. |
| Your cards | **TURN IN THE AIR** | They turn over on the way, arrive just above the holder's lip and slip in. |
| Their cards | **UNDER THE CABINET** | They land just clear of the cabinet, no fade, and slide up under it. |
| Styles | **FLICK** alone by default (a setting) | Eighteen in five tiers: Flick, Frisbee, Lob, Slide, Whip / Swoop, Skip, Spin, Flutter, Knuckleball / Boomerang, Shuriken, Magician, Glitch / Transporter, Comet / Railgun, Royal Flourish. Common and uncommon share the hands by weight (10/4); rare, epic and legendary are a surprise: once per hand (the default) one takes the whole hand (1/50, 1/80, 1/300 a hand, since v0.51.4), every card it's a single card's (1/500, 1/800, 1/3000 a card). |

Settings → Dealing: FLICK ONLY / ALL ON, once per hand or every card, and
one row per style (grouped by tier) with the sheet's switch and its rarity
as the sheet's segmented keys.

Reduced Motion: the deck's quiet deal, no styles.

