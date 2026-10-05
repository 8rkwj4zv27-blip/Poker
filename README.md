# Poker Faces

A strange, tactile, pixel-art Texas Hold'em machine for one player, built to
be installed on an iPhone home screen. Real no-limit Hold'em against a table
of characters who react, sulk, gloat and occasionally talk, played on a
deliberately dense velvet-and-brass console.

- **Play:** https://8rkwj4zv27-blip.github.io/Poker/ (GitHub Pages, served from `main`).
  On an iPhone, open it in Safari and choose **Share → Add to Home Screen**.
- **Version:** v0.64.4 (see [CHANGELOG.md](CHANGELOG.md)).
- **Modes:** Single Player runs, and Career (six venues, buy-ins, a bankroll).
  The coach, P.I.P., can teach as you play.

## How it is built

Plain HTML, CSS and JavaScript. No framework, no build step, no
dependencies: the repository is exactly what runs. `index.html` loads the
scripts in `js/` and the stylesheets in `css/` in a fixed order (they share
global functions), and `sw.js` keeps an offline copy so the installed game
plays without a signal.

```
index.html  sw.js  manifest.json  icon-*.png   the game and its offline/app shell
js/  css/  assets/                              the game's code, styles and art
*-lab.html  preview.html  card-flight-options.html
                                                Labs: prototyping pages, never shipped
pattern-book.html                               the visual design reference
validation/                                     test suites and QA tools
docs/                                           design rules, plans and history
```

Which file owns what: [docs/CODEMAP.md](docs/CODEMAP.md). Which docs are
current and which are history: [docs/README.md](docs/README.md).

## Run it locally

From the repository root:

```
python3 -m http.server 8765
```

then open http://localhost:8765. Add `?dev` to the address for the DEV panel
(forced all-ins, rigged deals, Career bankroll presets).

## Tests

Every suite needs only Node (22 or later):

```
npm test               # all 23 suites, about 4 minutes
npm run test:quick     # skips the three long AI/coach simulations, about 20 seconds
npm run play-test      # plays real hands in an emulated iPhone at three sizes
```

GitHub runs `npm test` on every pull request (`.github/workflows/tests.yml`).
`npm run play-test` needs Playwright and a Chromium (see
[validation/tools/README.md](validation/tools/README.md)); run it before
merging any change to files players download.

## Working on it

Read [CLAUDE.md](CLAUDE.md) first. It holds the project's rules for every
contributor, human or AI: the design principles, what must never change
(poker rules, saved games), and how visual Labs reach the owner. In short:

- Real Texas Hold'em stays correct; hand evaluation is tested against every
  possible five-card hand.
- Saved settings and lifetime statistics are preserved (the nine `felt.*` and
  `pip.coach` storage keys).
- The dense, cluttered console is intentional. Do not make it a clean,
  conventional mobile UI.
- No frameworks or dependencies without the owner's approval.
- Small changes, each through a pull request with green tests.

`docs/career/STATUS.md` states the current Career build and the next task.
The pre-audit checkpoint and how to restore it are in
[docs/audit/PHASE0_BASELINE.md](docs/audit/PHASE0_BASELINE.md).

## Licence

Copyright © 2026 the owner of this repository. All rights reserved. See
[LICENSE](LICENSE).
