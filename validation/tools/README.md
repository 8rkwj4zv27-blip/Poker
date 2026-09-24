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
