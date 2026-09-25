# Poker Faces — visual & polish audit (25 September 2026)

Build audited: v0.40.0-dev · CRT rebuild (branch claude/poker-faces-design-audit-qx3v1u).

A full-screen/motion/glitch audit of the whole game, captured in the real game in headless Chromium at iPhone sizes. The illustrated version (screenshots for every finding) was published as a private Artifact for the owner; this file is the durable copy for future sessions. It is a proposal, not approval: nothing here changes a signed-off finish until the owner picks it (see `PATTERN_BOOK.md`).

## Status after the fix pass (v0.40.1, 25 September 2026)

The owner split the work: **fix everything that isn't a design decision now**,
then a **V2 design pass** across the whole game. The player dashboard was to be
left exactly as it is for now.

**Fixed in the fix pass**
- F1 ligatures (off on every element; a `font:` shorthand had re-enabled them).
- F2 first-run card now shows before the Table Intro and the deal waits for it;
  F3 the line about the unreachable Coach button is gone.
- F4 all-in runouts read ALL IN / RUNNING IT OUT; F5 hand-log grammar.
- F6 pot names: layers with the same eligible players share one name and one
  log/review line (presentation only; payout, scoring and K.O. untouched).
- F7 pot plate clears the deck; F8 showdown lane forms on the board row;
  F9 reward/K.O. text sits on a dark band centred on the board;
  F10 the pot plate holds and counts down instead of reading POT 0.
- F11 result stages fit 390x844 and the SE (the busted-by line was unstyled
  15px type); F12 Home fits the SE; F13 Custom Game uses the approved compact
  choice rows; F14 Settings: coral danger key, Leave table/Reset only where
  they apply, Developer Mode on a quiet service row.
- Owner-spotted: ticket DETAILS side re-laid out (no overlap, compact SE
  layout, shared baselines, payouts columns, TOP-2 kept together); Hub
  bankroll rail keys no longer touch.
- Settings tidied (Screen header A with a back key on Settings, Finishes and
  Scoring Guide; one spacing rhythm; opens at the top).
- Back paths (Career->Home, Back to Events, Leave table) turn the Machine
  Wheel the other way instead of hard-cutting.

**V2 design pass (not started — each starts in a Lab for sign-off)**
- Player dashboard: rims/borders overlapping at close zoom; the bank (revamp;
  chips vanish just before the hatch and the pile pops back in one go — the
  intake removes each chip at the rim, then `rebuildBankPileFromState()`);
  stale readouts in results mode (F17); STACK reel half hidden behind NEXT
  TABLE on TABLE CLEARED (F11b); the banner CRT clipping long lines such as
  "YOU WIN · PAIR OF FOU…".
- Chips: the pot pile's chips overlap in ways that aren't physically possible.
- Enemy seat cards, table talk (F21), gameplay animations (all-in reveal,
  reward plates, bet spots, dealer puck), sub-screen page change and dialog
  motion, the sub-screens themselves, Coach, themes/Velvet (F19), Home
  nameplate (F18), reel cell counts (F15), CRT ghosting (F16).
- Career Hub on an iPhone SE: BUY IN still starts below the fold — fitting
  it needs a compact ticket and cartridge, which is a design change.

## Verdict

The showpieces are very good. Home Boot, the Machine Wheel, the Career ticket rack, the buy-in feed, the Table Intro, press feel, and the CRT system all look and move like one strange velvet poker machine. They set the standard.

The rest of the game hasn’t caught up with them. Everything around and between those showpieces still looks like a first draft. The sub-screens (Custom Game, Rankings, Awards, Settings, dialogs, the log) are flat mobile panels that hard-cut in and out. The biggest moments at the table (all-in, showdown, reward, K.O.) have real collisions: text painted over cards, plates under the deck, a clipped results stage. And the characters are muted, because table talk is switched off in code.

That makes the upgrade clear. Fix the glitches first (most are CSS or one-line string fixes). Finish the Pattern Book migrations you already approved. Then spend the big motion effort on the table’s own drama and on giving every screen change a machine movement, so the whole game plays at the level of the Career Hub.

**Already great:** Home Boot (Relay clunk, marquee letters catching, faces dropping into the tray. A great first ten seconds); Machine Wheel (Home→Career and table↔results rolls have real weight, overshoot and stepped house lights); Ticket rack + buy-in feed (Touch physics, the lift-over swap, the ticket ratcheted into the mouth while the bankroll counts down); Table Intro (The same ticket stamped ENTRY PAID on the felt, seat roll call, stacks dropping through the hatch); Showdown card language (Gold frames on the cards that play, mint on the kicker. Clear, and it teaches); Chip flights and pile (All-in chips arc into a pile that grows with the pot; payout scatters them physically); CRT system + press feel (One component, one recipe, one thunk. The consistency work is paying off).

## Scorecard

| Screen / moment | Grade | What holds it back |
|---|---|---|
| Home Boot | Showpiece | Relay, marquee, faces drop. Keep. |
| Home menu | Solid | Dev-string nameplate; dead "0 — —" stats on first launch; no idle life beyond the faces. |
| Home → Career roll | Showpiece | The reference for every other transition. |
| Career Hub | Showpiece | SE fold (F12), CRT double exposure (F16), and an empty black strip above INSERT TICKET. |
| Buy-in → table | Showpiece | About 1s of near-black screen between the grind and the table (2.7–3.5s). |
| Table Intro | Strong | Quick Deal’s ticket just says "HOUSE GAME / TABLE", which is generic next to Career’s venue tickets. |
| Table in play | Solid | Big empty felt centre; no dealer puck; bets shown only as text; 2-opponent tables pin seats to the corners; the board has no printed slots. |
| Raise panel | Solid | The slider track is a bare black bar with no scale; the panel cuts across the hearts and HUD with a hard edge. |
| All-in + runout | Unfinished | Hands stay face down until showdown, there’s no tension beat, and the banner is wrong (F4). |
| Showdown | Solid | Good highlight language, but layout collisions (F7, F8), and the award console turns a flat olive. |
| Reward / score | Unfinished | Energetic but messy: text over cards (F9), money ordering (F10). |
| K.O. | Strong | The portrait eject and K.O.! stamp work; same overlap problem. |
| Result stages | Solid | The chassis is right; clipping (F11), a dead lower console, and EVENT WON has no celebration for a $300 prize. |
| Custom Game | First draft | A form: overflow, mixed case, double headings ("THE TABLE 4" over a stepper that also says 4). |
| Hand Rankings | Solid | Correct and readable, but a static list. |
| Score / Awards | First draft | The weakest screen: 12 identical "??? LOCKED" rows. |
| Settings / Finishes / Scoring Guide | First draft | A generic bottom sheet; F1, F14; the Scoring Guide is a wall of text. |
| Hand log | First draft | A generic drawer; F5, F6. |
| Dialogs + first-run | First draft | They pop in with no motion as a flat full-width band; F2, F3. |

## Fix first

Severity: **Broken** = wrong or misleading on screen; **Glitch** = visible collision, clipping or wrong text; **Polish** = inconsistent with the rest of the machine.

### F1 · Broken · The pixel font turns "fi" and "fl" into "A"

- **What you see:** Everywhere Pixelify Sans is used: Settings reads "ConArm All-In", Custom Game reads "Blinds stay Axed", "bluffs" shows as "bluf fs", and Finishes and hint text are affected too.
- **Cause:** The embedded Pixelify Sans subset has broken ligature glyphs, and browsers apply standard ligatures by default.
- **Fix:** Add `font-variant-ligatures: none` on `body` in `css/01-foundation.css`. One line; every screen is fixed.

### F2 · Broken · Dealt cards fly over the first-run card, which also hides the Table Intro

- **What you see:** On a brand-new player’s first table, "Before your first hand" appears as the intro starts, so their first look at the machine powering up is behind a dark overlay. Then a dealt card flies across the card’s text.
- **Cause:** `#first-run` is missing from the overlays that hide body-level FX (`css/04-overlays-and-modes.css` ~76–97), and `startGame` shows it right before `startNewHand` (`js/07-ui-wiring.js:363`).
- **Fix:** Add `body:has(#first-run:not(.hidden))` to the suppression list, and show the card after the intro has landed (or before the table arrives).

### F3 · Broken · First-run points to a Coach button that doesn’t exist

- **What you see:** "Tap Coach at the top of the table for live odds" is shown to every new player. The top bar has only SAVE and ⚙.
- **Cause:** `settings.coach` defaults to false (`js/02-support-systems.js:718`) and there is no toggle for it anywhere. The coach panel is fully built (`index.html:323`) but unreachable.
- **Fix:** Your call: bring Coach back as a machine instrument (see idea 2) or delete the line.

### F4 · Glitch · "YOU IS THINKING…" during all-in runouts

- **What you see:** When everyone is all in and the board runs out, the banner CRT says "YOU / IS THINKING…" with a blinking cursor. Nobody is thinking.
- **Cause:** `describeCurrentTurn()` (`js/06-presentation.js:3989`) still names the seat at `currentIndex`; for the human that reads "You is thinking".
- **Fix:** During a runout, show a runout line such as "ALL IN · RUNNING IT OUT". Never print "is thinking" for the human.

### F5 · Glitch · Hand log grammar: "You calls", "You raises to 40"

- **What you see:** Every human line in the log uses third-person verbs.
- **Cause:** Lines are built as `player.name + ' calls '` (`js/05-game-engine.js` ~1216–1236), and the human’s name is "You".
- **Fix:** Use second-person verbs for the human (call / raise / check / bet / fold).

### F6 · Glitch · A phantom side pot in the log ("side pot 1 1,960")

- **What you see:** Heads-up to the river, nobody else all in for less, and the log says "You win main pot 60…" then "You win side pot 1 1,960…". That second line reads as 11,960.
- **Cause:** `computePots()` starts a new layer at every contribution level, including a folded player’s (Shark folded his 20 big blind). Two layers with identical eligible players get labelled main + side. **The chips paid out are correct.**
- **Fix:** Presentation only, but it sits next to pot code, so it needs your OK: merge adjacent layers with the same eligible players when labelling and logging, and write "Side pot 1: 1,960".

### F7 · Glitch · The pot plate slides under the dealer deck

- **What you see:** At four or more digits ("POT 2,020") the plate grows to the left and the deck covers the word POT. It happens on every big pot.
- **Fix:** Anchor the plate to the right of the deck, or give the deck a fixed gutter.

### F8 · Glitch · Showdown rail collisions hide the losing hand

- **What you see:** The rail runs over the leftmost seat’s hole cards, so you can’t see what the loser had. The board cards that don’t play drop beneath the rail, and the "TWO PAIR" plate sits on top of the 2♠.
- **Fix:** Give the rail its own band between the seats and the pot. Show the losing hand face-up at its seat, and put the hand-name plate below the dropped cards.

### F9 · Glitch · Reward text is painted straight over the cards

- **What you see:** "BIG WIN", "+150", the rolling total "800" and "K.O.! +400" are drawn directly on the board cards and the opponent’s hole cards, with no plate behind them. The numbers are unreadable against the card faces just when they matter.
- **Fix:** Draw rewards on plates in a reserved band (see idea 5).

### F10 · Glitch · Money appears to vanish for about four seconds

- **What you see:** During the reward sequence the pot reads "POT 0" while the chip pile still sits on the felt, and the stack still reads $0 until the chips finally fly.
- **Fix:** Count the pot plate down and the stack reel up together while the pile flies. Money should visibly move, never disappear.

### F11 · Glitch · Result stages clip on standard iPhones

- **What you see:** At 390×844 (iPhone 12–15), RUN OVER’s Best Hand row is cut off ("SIXES OVER …") and TABLE CLEARED’s STACK reel is half hidden behind NEXT TABLE. At 375×667 (SE), FULL HOUSE becomes "HOUSE", the cards shrink, and "BUSTED ON TABLE 1" collides with RUN OVER.
- **Fix:** Give the stage a height budget per row with a compact variant below ~700px. Hide the dashboard reel in results mode (see F17).

### F12 · Glitch · On an iPhone SE the main button is below the fold

- **What you see:** Home needs 749px (the Quick Deal row is cut off), and the Career Hub needs 850px, so BUY IN starts at y=660 of 667. On the table, the pot plate sits on the hole cards.
- **Fix:** Add a short-screen layout (`max-height: 700px`): tighten the title well and stat row on Home, and shorten the ticket rack on the Hub so the console always fits.

### F13 · Glitch · Custom Game: "Elimination" pokes past its panel

- **What you see:** At 390 wide the third segment breaks the panel’s right edge. The segment labels are mixed-case Press Start ("Cash", "Tournament"), while every other key in the game is uppercase.
- **Fix:** Uppercase the segments at a smaller size (like the stakes keys), or stack them two plus one.

### F14 · Glitch · Danger keys aren’t coral, and Settings shows the wrong keys

- **What you see:** Reset Current Run has `.btn-danger` but draws as the same green key as Done. Leave Table is offered from the Home screen, where there is no table. The Developer Mode switch is visible to players.
- **Cause:** The machine-system button styles override `.btn-secondary.btn-danger`.
- **Fix:** Covered by the approved Danger D3 migration. Hide Leave Table off-table, and move Developer Mode behind a hidden gesture or `?dev`.

### F15 · Polish · Odometer cell counts drift between parts

- **What you see:** Seat reels show "$0990" (4 cells) next to "$01000" (5 cells), and an all-in seat shows "$00". The win reel gives the comma its own cell ("$ 2 , 0 2 0").
- **Fix:** Same job, same finish: a fixed cell count per reel family, with the comma printed between cells. This belongs with the Pattern Book’s Round 2 number wheels.

### F16 · Polish · CRT ghosting reads as a double exposure on text

- **What you see:** When the Career record swaps "EVENTS PLAYED / EVENTS WON" ↔ "TOTAL OWNED / HIGHEST ACCESS", both sets are legible at once. On RUN OVER, "+400" sits behind "2".
- **Fix:** Check it on device. The signed-off ghost (2) may want to apply to figures only, or fade faster on caption text.

### F17 · Polish · Result screens keep stale readouts

- **What you see:** Under TABLE CLEARED and EVENT WON, the dashboard still reads "TWO PAIR, ACES & SEVENS" and "BET THIS HAND $1000", and the top bar still says "Hand 1 · 10/20". It’s dimmed, but it’s readable, and it’s wrong.
- **Fix:** Blank these readouts in results mode, or repurpose the console (idea 6).

### F18 · Polish · The Home nameplate is a dev string

- **What you see:** "V0.40.0-DEV · CRT REBUILD" is the top-left brand, wrapping to two lines. STATUS.md still says v0.39.5. The "BEST HAND WIN" label touches its cell edges.
- **Fix:** Etch a real nameplate there ("POKER FACES · ELECTRONIC TABLE GAME") and move the build string to a service plate in Settings.

### F19 · Polish · Themes break colour meaning, and none is velvet + felt

- **What you see:** Midnight turns the money parts blue (pot plate, stack reel rim, Career cartridge), though gold means money. Burgundy turns the felt burgundy too. No theme gives the brief’s look (a burgundy velvet cabinet around green felt), and the default, Emerald, is green on green.
- **Fix:** Lock money = gold and danger = coral in every theme. Add a "Velvet" theme (burgundy cabinet, green felt) and consider making it the default. That’s a product decision for you.

### F20 · Polish · Four finishes for small keys

- **What you see:** Home’s gear is a green key, the Career keys are cream, the table’s SAVE and gear are dark tiles, and the back arrows on Settings, Custom Game and Rankings are green tiles.
- **Fix:** These are exactly the families approved on 24 Sep and not yet migrated (small key B, screen header A). Migrating them fixes this.

### F21 · Polish · Table talk is switched off entirely

- **What you see:** `bubblesAllowed()` returns `false` (`js/03-opponents.js:111`), so none of the personality lines in `TABLE_TALK` ever appear. The brief says personality, mood and occasional table talk are important.
- **Fix:** Bring it back as a rare event through the machine (idea 4).

## Motion map

| From → to | Now | How | Proposed |
|---|---|---|---|
| Cold launch → Home | Moves | Home Boot | Keep |
| Home → Career | Moves | Machine Wheel roll | Keep |
| Career → Home (Back) | Hard cut | Hard cut | Short reverse roll (~500ms, skippable) on the same drum |
| Home → Custom Game / Rankings / Awards | Hard cut | Hard cut | One shared "page change" for sub-screens |
| Sub-screen → Home | Hard cut | Hard cut | The same page change, reversed |
| Career BUY IN → table | Moves | Ticket feed + roll + Table Intro | Fill the ~1s black gap (the drum passing, or NOW SEATING on the readout) |
| Quick Deal / Deal Me In → table | Partly | Cut, then Table Intro | Print a house ticket and feed it, reusing the Career feed |
| Table → results | Moves | Machine Wheel roll | Keep |
| Results → Career (Back to Events) | Hard cut | Hard cut | Reverse roll into the Hub; the ticket returns stamped (idea 6) |
| Table → Home (Leave Table) | Hard cut | Hard cut | Power-down: lamps step off, then the roll |
| Settings / Scoring Guide sheet | Partly | Stepped slide-up (generic) | A maintenance hatch that unlatches with a clunk |
| Settings ↔ Finishes page | Hard cut | Instant swap | The shared page change |
| Hand log drawer | Partly | Stepped slide-in | A receipt tape feeding out |
| Confirm dialog | Hard cut | Instant pop | A warning plate that drops in four steps, with a lamp that blinks on danger |
| First-run card | Hard cut | Instant, over the intro | After the intro, as the same warning plate |
| Raise panel | Partly | scaleY open | Fine; add scale marks and a detent click per BB step |

## Level-up ideas

### 1. Every screen change is a machine movement

Build one shared page change for the sub-screens: a pixel-stepped shutter drops from the top rail with a ratchet click, holds one frame of black, and lifts on the new page (300–450ms, skippable, a plain cut under Reduced Motion). Back runs it upward. For the two big "leave" paths (Career→Home, Results→Career), use a short reverse roll on the existing drum with a light `MACHINE_WHEEL_CONFIG` preset. Dialogs and the first-run card become a warning plate that drops in. Settings becomes a hatch. Audition three candidates in a `nav-lab.html` before anything goes live.

_Addresses: Motion map rows 3, 4, 5, 9, 10, 12, 14, 15_

### 2. Make the all-in the best moment in the game

When the betting closes with an all-in: (a) the console flips to a SHOWDOWN face; (b) every live hand turns face up with the existing card turn, one seat at a time (this is how real Hold’em plays it); (c) an equity instrument on the HUD CRT shows each hand’s chance ("YOU 71% · PROF 29%") and re-counts after each street, which teaches poker as instrumentation and could be the reborn Coach; (d) the river waits a beat, sliding out face down, pausing about 400ms, then turning, while the faces react (nervous → panic, smug → shocked). Quick Resolve stays.

_Addresses: F3, F4, F8; the "unfinished" all-in row_

### 3. Put the money on the felt

Add bet spots in front of each seat: chips slide from the seat into its spot when it bets and sweep into the pot at the end of the street. Add a dealer puck (D) that slides seat to seat each hand; today only SB/BB badges exist. Print five faint card outlines where the board lands, and a dim felt print ("POKER FACES · ELECTRONIC TABLE GAME") in the dead centre. On a win, the pot plate counts down while the stack reel counts up as the pile flies. All of this is felt only; the dashboard geometry stays as it is, since that was rejected before.

_Addresses: F7, F10; "Table in play" dressing_

### 4. Let the faces talk, rarely, through the machine

The dashboard already has a speaker grille that does nothing. When a character speaks, the grille lamps up with a small crackle and the line types out on the banner CRT under their name. Allow-list the moments: going all in, a big pot won, a bad beat, being K.O.’d, and your K.O. of them, with at most one line every few hands. Add face micro-reactions to the board: a scare card lands and a nervous flash crosses the seats that fear it; the winner glances at the pot. `setMood()` already exists; this adds triggers and a presentation for the lines already written in `TABLE_TALK`.

_Addresses: F21_

### 5. Rewards on plates, not paint

POT WINNINGS, BIG WIN, MONSTER HAND and K.O.! drop as bolted printed plates into a reserved band above the board, each with its own small mechanical reel for the points. The plate then slides up into the SCORE bar, whose reel rolls. Nothing ever covers a card, and the K.O. stamp follows the same rule.

_Addresses: F9_

### 6. Ceremonies that close loops

EVENT WON: the ENTRY PAID ticket from the Table Intro comes back through the slot stamped PAID OUT $300, marquee lamps chase around the stage bezel, and the prize rolls into the bankroll reel on the way back to the Hub. RUN OVER / EVENT LOST: a CRT power-down (the picture collapses to a line, then a dot) and a coral lamp. During results, the lower console either goes dark except for one lamp by the button, or becomes a receipt printer that prints the session summary.

_Addresses: F17; EVENT WON has no celebration_

### 7. Sub-screens as parts of the cabinet

**Score / Awards:** a trophy case of 12 sockets behind glass. Locked ones are dark with a one-word engraved hint; found ones light gold with the date. **Hand Rankings:** tap a row and its five cards lift while the cards that don’t count dim (the showdown’s gold/mint language), and your lifetime best hand’s row has its lamp lit. **Custom Game:** a configuration ticket prints as you change settings, then feeds through a slot on DEAL ME IN, matching the house ticket the Table Intro already shows. **Settings:** a quieter service panel with screwed-on plates, toggles as switches with lamps, coral danger keys, and the version and Developer Mode on a small service plate. **Hand log:** a receipt tape, one torn slip per hand, streets marked by perforations.

_Addresses: All "draft" rows_

### 8. Home attract mode

This lines up with the main-menu passes already on your list (top-bar clean-up, counter-drum stats, pokeable faces, live ticker). An etched nameplate replaces the dev string. After about 20s idle, the marquee chases, the readout ticker cycles HIGH SCORE / BEST HAND / BANKROLL, and the House Faces glance at each other. Stats become counter drums, and a first launch reads "NO HANDS PLAYED" instead of "0 — —".

_Addresses: F18; Home menu row_

### 9. Colour that means something in every theme

Money is always gold, danger always coral, whatever the theme; only cabinet materials change. Add a Velvet theme that matches the brief (a burgundy cabinet around green felt).

_Addresses: F19_

## Plan

| Phase | Scope | Size | Proof |
|---|---|---|---|
| P0 Fix pass | F1–F14, F17, F18. Mostly CSS and strings; no poker or save changes (F6 waits for your OK). | S | Before/after screenshots at 390×844, 375×667 and 430×932, plus Reduced Motion; `pattern-book-checks`, `crt-consistency` and the existing suites. |
| P1 Finish the approved Pattern Book migrations | Hero, standard and danger buttons, small key, choice row, screen header: one family per release, as the book says. This fixes F14 and F20 at the root. Reel cell rules (F15) go to the Round 2 sign-off. | M | The book’s "Now" vs. migrated captures for each family. |
| P2 Navigation motion | Idea 1: a `nav-lab.html` with three candidates, your sign-off, then the shared page change, the reverse rolls, the dialog plate and the first-run timing. | M | Contact sheets of each transition and a skip test. |
| P3 The table’s big moments | Ideas 2 and 5 plus the F7/F8 layout fix: the all-in reveal and equity CRT, the river sweat, reward plates, and money choreography (F10). Extend `showdown-rail-lab.html`. | L | Frame sheets of all-in, showdown, K.O. and reward sequences. |
| P4 Felt dressing | Idea 3: bet spots and the sweep, dealer puck, printed board slots, felt print, and better 2- and 3-opponent seat layouts. Prototype in `chip-motion-lab.html`. | M | Seat layouts at 2, 3, 4 and 5 opponents. |
| P5 Characters | Idea 4: speaker-grille table talk with an allow-list, plus board reactions. You set the frequency. | M | A 30-hand DEV session log of when lines fired. |
| P6 Ceremonies | Idea 6: the PAID OUT ticket, marquee chase, power-down and a console that means something during results. | M | EVENT WON / LOST / CLEARED / RUN OVER frame sheets. |
| P7 Sub-screens rebuilt | Idea 7, one screen per release: Awards case, then Rankings, Custom Game ticket, Settings panel, log tape, Scoring Guide. | L | Each one signed off from a live demo before it goes into the book. |
| P8 Home attract + colour | Ideas 8 and 9. Needs your decision on a Velvet default. | M | Theme sheet across all themes. |

## Owner decisions needed

1. Coach: bring it back (as the all-in equity instrument or a toggle), or remove the first-run line?
2. Phantom side pot (F6): OK to merge same-eligibility layers in labels and the log only? The payout code stays untouched.
3. A Velvet theme (burgundy cabinet, green felt): add it, and should it be the default?
4. Table talk: how rare? My suggestion is one line every 4–6 hands at most, only on allow-listed moments.
5. Bet spots and a dealer puck on the felt: are these OK as felt changes, given dashboard geometry stays locked?

## Method

- The real game in headless Chromium with touch emulation (`validation/tools/touch-harness.js`) at 390×844, 375×667 and 844×390, in all four themes.
- Timed frame series of Home Boot, Home→Career, buy-in, Table Intro, betting streets, all-in runout, showdown, reward and K.O., TABLE CLEARED, RUN OVER, EVENT WON and EVENT LOST (the result stages use the DEV fixtures, so some numbers on them are fixture values).
- Code reading for every transition path, overlay, and each finding’s cause.
- Not covered: a real iPhone (feel, haptics, Safari rendering), audio, a full Reduced Motion pass, and the Career cash table.
