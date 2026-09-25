# Dashboard V2 — handover

This is where the Dashboard V2 work stood on 25 September 2026. It is written
so a new session (Codex or Claude) can pick it up without the original chat.
Read `AGENTS.md` / `CLAUDE.md`, `docs/CODEMAP.md` and
`docs/ui/PATTERN_BOOK.md` first, then this file.

- Branch: `claude/poker-dashboard-v2-upgrade-7xgsx9` (not merged; no PR yet).
- Production files are **unchanged** on this branch. Everything below is Lab
  or docs.

## The goal

Upgrade the player's dashboard (the bottom HUD: hole cards, chip bank, hand
and turn readouts, stack counter, blind lamps, bet readout, the FOLD /
CHECK / RAISE bay, the raise panel) from V1 to a polished, exciting V2. The
owner wants it to feel physical and alive, like operating a tactile poker
machine, with bigger theatre for the big moments. It must stay inside the
game's existing visual language.

## What has been tried, and the owner's verdict

### Attempt 1: finish-only polish (rejected: "nothing has changed much")

A lab of CSS-only finish options on the locked V1 layout (tidier case, felt
chip tray, card-slot lip, lamps, bezel plates, cradle for the buttons). It
was too cautious; the owner asked for bolder ideas, and said layout,
interactions and gameplay moments may all change.
Files: deleted in `f8c9bfa`; recoverable from `cfa57fe` (`dashboard-lab.html`,
`css/dashboard-v2.css`).

### Attempt 2: Dashboard 2.0 Lab (rejected: "a fail")

`dashboard-v2-lab.html` + `js/dashboard-v2-lab.js` + `css/dashboard-v2-lab.css`
(commit `f8c9bfa`). A standalone, playable prototype: four directions (V1+,
Console, Slot, Cockpit), three dashboard heights, and many interactions
(lever, dial, throttle, chip dragging, shutter, gears, paytable,
annunciator tiles, break-on-bust).

Owner verdict, in their words: it lost the original charm. It looks like a
"cheap, tacky 2D flash game". The bevelled, instrument, soft-3D indie
aesthetic disappeared. Over-complicated ("random cogs"), overlapping
elements, shoddy UI, bad readability, not UX friendly.

**Do not build on its visuals.** Treat the directions, gears, paytable,
lever, dial, throttle, annunciator, chip dragging and the new case styling
as rejected.

## What the owner liked, to carry forward

1. **Double-tap to check (knock).** Double-tap the dashboard case to
   check, like knocking on a real table. If facing a bet, it refuses with a
   small buzz and a message. The three buttons still work as normal.
   Lab reference: `knock()` in `js/dashboard-v2-lab.js` (~line 961) and its
   listener in `wireDash()`.
2. **Card peek.** Hole cards arrive face-down; press and hold to lift and
   see them; release to hide them again. The hand readout stays hidden
   until the first peek. Lab reference: `renderPeek()` (~line 912) and the
   tray pointer listeners in `wireDash()`.
3. **Charging the ALL IN.** Hold the all-in key to charge it (a fill bar
   and a rising tick), releasing early cancels, full charge commits. Lab
   reference: `startHold()` (~line 1168), `commitAllIn()`.
4. **The ALL IN moment: theatrical lights and hum.** Beacons and warning
   lights, a low machine hum or siren, a shake, the felt dimming, and a
   tense card-by-card run-out with a heartbeat. Lab reference:
   `allInCeremony()` (~line 1198), `runOut()` (~line 327), the lab-only
   synth voices in `SFX` (~line 92), and `Sound.wheelMotor()` for the hum.

Only the behaviour and feel of these carry forward, not how they looked in
the lab.

## Where the real dashboard lives (production)

- Markup: `index.html`, `#your-seat-dock` → `#hud-frame` (`#hud-left`
  chip bank, `#hud-mid` cards + `#hand-strength` + `#banner` + `#jackpot`
  stack, `#hud-right` blind lamps + `#hud-invested` + speaker), then
  `#action-area` → `.actions-dock` (`#raise-panel`, `#action-console`
  with FOLD / CHECK / RAISE, AWARD POT face).
- Styles, in load order, all layered: `css/02-screens.css` (~1060–1400),
  `css/03-action-console.css` (~440–748), `css/05-responsive-and-arcade.css`
  (~540–730, the latest "tidy-up" overrides), `css/06-machine-system.css`,
  and `css/machine-crt.css` (the CRT glass; must stay the last stylesheet).
- Behaviour: `js/06-presentation.js`: `render()` (~3703), `initSeats()`,
  `openRaisePanel()` (~3843), `showHudResultConsole()` (~4428), bank chip
  physics (`bankPile()`, measures `#hud-left`); `js/05-game-engine.js`:
  `humanAct()` (~3563), the only place a human action is applied.
- Visual reference of V1: `docs/ui/references/production-dashboard.jpg`.

## Rules and history that still apply

- `docs/ui/PATTERN_BOOK.md`: one finish per job. The CRT glass, ink,
  flicker and blink are owned by `css/machine-crt.css`. FOLD / CHECK / CALL /
  RAISE are a locked button family. New parts get sign-off and a Pattern
  Book entry before use.
- `docs/ui/handover/HISTORY_AND_REJECTIONS.md`: earlier rejected paths
  (generic clean UI, flattened pixel art, thin outlines, replacement card
  and chip art, recolouring authored art).
- Printed text on physical parts does not glow; CRT text does.
- Poker logic, saves and settings must not change for presentation work.
- Bump `BUILD_VERSION` (`js/02-support-systems.js`) and `CACHE_NAME`
  (`sw.js`) together on every release.

## Known V1 issue found along the way

On short phones (320×700, 390×664) V1 clips the bottom of the stack counter
(`#jackpot`) by 8–13px. Worth fixing in whatever V2 becomes.

## Suggested way forward

1. Keep V1's look as the starting point: its bevelled, soft-3D instrument
   feel is what the owner values. Polish it rather than replace it.
2. Build the four liked behaviours into the **real game**, one at a time,
   in a sandboxed lab page that runs the real `index.html` (see how
   `intro-lab.html` / `js/intro-lab.js` sandbox the game with in-memory
   storage and no service worker). Suggested order: card peek, double-tap
   check, hold-to-charge all-in, then the all-in lights, hum and run-out.
3. Each behaviour should be switchable on/off in the lab for comparison, and
   readable at 430×932 (iPhone 15 Pro Max) first, then 390×844 and 320×700.
4. Show the owner screenshots or a live lab before moving on to the next.

## How to preview and test

- Serve the repo: `python3 -m http.server 8765`, open
  `http://localhost:8765/index.html` or any `*-lab.html`.
- Validation suites: `node validation/<name>.js` (see `docs/CODEMAP.md`);
  `node validation/pattern-book-checks.js` for Pattern Book rules.
- Browser/touch harness and screenshot contact sheets:
  `validation/tools/README.md`.
