# QA tools

Reusable browser/touch-emulation tooling for manual and scripted checks,
without a physical device. These exist so a future session doesn't rebuild
a Playwright harness from scratch every time a visual/touch pass needs
verifying — that rebuild cost real time and tokens on 2026-09-24 and is now
paid once.

Requires the `playwright` package (present via `npm root -g` in this
environment) and the pre-installed Chromium under `/opt/pw-browsers` — do
**not** run `playwright install`, see the environment notes.

## 1. Serve the app locally

From the repo root:

```
python3 -m http.server 8765
```

Leave it running in the background; all the tools below assume
`http://localhost:8765`.

## 2. `touch-harness.js` — reusable Playwright + touch helper

A small library, not a script to run directly. Exposes `withPage(opts, fn)`
(launches a mobile-emulated Chromium context with real `Input.dispatchTouchEvent`
touch support and collects console/page errors) and a `touch` helper with
`start`/`move`/`end`/`drag`/`flick`. See the doc comment at the top of the
file for a minimal example, and `career-hub-scenario.js` for a full one.

Use this instead of writing raw CDP calls — it already handles the
mobile-viewport/touch-context setup and error collection correctly.

## 3. `career-hub-scenario.js` — worked example / regression scenario

```
node validation/tools/career-hub-scenario.js [width] [height]   # default 430 932
```

Exercises the Career Hub touch rack (slow drag, hard flick), a real buy-in
(exactly one debit, first hand dealt), reload → `CONTINUE`, tap-to-skip
mid-transition, and prints state at each step. No assertions beyond "no
console/page errors" — read the printed JSON to judge correctness, or copy
this file's structure for a new scenario.

Run it at a few sizes when touching Career Hub presentation:

```
for wh in "430 932" "390 844" "320 700"; do
  node validation/tools/career-hub-scenario.js $wh
done
```

## 4. `contact-sheet.js` — batch screenshots into one image

Each screenshot reviewed individually costs real tokens; batching a whole
animation sequence into one grid image is far cheaper to review.

```
node validation/tools/contact-sheet.js <shotsDir> <outFile.png> [prefix] [cols]
```

Pair with `touch-harness.js`'s `screenshotSeries(page, dir, prefix, marksMs)`
to capture a timed sequence (e.g. frames of a transition at 300/700/1000ms),
then build one sheet from them instead of sending N separate images.

## Notes

- `serviceWorkers: 'block'` is set in `touch-harness.js` so a stale cached
  build never shadows local edits during testing.
- `reducedMotion` is a `withPage` option — always check both the normal and
  Reduced Motion paths for any animation change.
- iOS Safari does not support `navigator.vibrate`; `haptic()` calls are
  silent no-ops there by design. Don't rely on haptics as evidence of
  anything when reasoning about the iPhone experience.

## 5. `crt-consistency.js` — every CRT part against its twins

The rendered-style guard for the CRT component (docs/ui/PATTERN_BOOK.md).
Opens Home, Career, the table, TABLE CLEARED and RUN OVER and compares every
CRT's glass, and every Line, Figure and Caption, as the browser draws them
(size, weight, spacing, glow, and ink per meaning). Any difference fails,
naming both screens.

```
node validation/tools/crt-consistency.js [width] [height] [theme]   # default 390 844 midnight
```

Run it after any change that touches a CRT, in a couple of themes and sizes.

## `lab-bundle.js` — publish a visual lab as a link

The owner receives every visual lab as a private Artifact link (see
"Visual labs" in `CLAUDE.md`). This stages a lab for that:

```
node validation/tools/lab-bundle.js showdown-lab.html <scratchpad>/bundle-showdown
```

It writes the lab page without its document wrapper (the Artifact adds
its own), `game.html` (a copy of `index.html`, which an Artifact reserves;
a shim sends the lab's `fetch('index.html')` there), every css/js/asset
the game and the lab load, and `files.json` for the Artifact tool's
`files` (publish with `root` set to the bundle folder).

Labs that declare `<script type="application/json" id="lab-inject">`
(phone-first labs, see `CLAUDE.md`) are baked: `game.html` gets the
storage shim, loses the service worker and gains the lab's parts, and the
page loads it directly (`window.LAB_STATIC`).

## `play-test.js` — the real game, played with real taps

```
npm run play-test                                   # 2 hands at 320x700, 390x844 and 430x932
node validation/tools/play-test.js --hands 3 --sizes 390x844 --shots /tmp/shots
```

Serves the repo itself (no `http.server` needed), clears storage, starts a
Single Player run and plays it the way a player would: skip the tour,
Check/Call, Award Pot, Next Hand, NEW RUN after a bust. Fails on any
JavaScript error, a table stuck for 90 seconds, or sideways scrolling. On the
first error it prints the table's state and the last 15 taps (and a
screenshot with `--shots`), so an intermittent bug arrives with its cause.
Run it before and after any change to files players download. Not part of
`npm test`, which needs nothing but Node.

## `event-sim.js` — whole Career events, measured

```
node validation/tools/event-sim.js back-room-freezeout
node validation/tools/event-sim.js back-room-freezeout --stack 1000 --per-level 15 --skill 20
```

Plays complete events from the real catalogue (`CAREER_EVENT_LIST`):
stacks carry over, blinds rise on the event's schedule, players bust and
places are paid from its payout table. "You" are the game's AI at a skill
(`--you 30,50,80`, or `abc`). Prints, for each: how often you win and
cash, your average profit per event, the event's length in hands, and how
often an opponent knocks the other out first. Override any setting
(`--stack`, `--per-level`, `--skill`, `--players`, `--payouts`,
`--buy-in`) to measure a proposal before building it. About 1,500 events
take a few minutes. Not part of `npm test`.
