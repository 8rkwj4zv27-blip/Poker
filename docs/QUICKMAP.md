# Quick map

The short version of [`CODEMAP.md`](CODEMAP.md). Read it after
[`HANDOVER.md`](HANDOVER.md), before searching the code. Open
`CODEMAP.md` only for the section about the file you are about to change
(its headings are the file names). Last checked: 6 October 2026 (v0.65.0).

## How the game is put together

Plain HTML/CSS/JS, no build step, no modules: every script is global and
loads in the order `index.html` lists, and later files call earlier ones.
`sw.js` precaches the same list (`APP_SHELL`, with matching `?v=` tags)
so the installed iPhone app plays offline. A file not in `index.html` and
`sw.js` is not shipped.

## Where things live (`js/`, in load order)

| File | Owns |
| --- | --- |
| `01-poker-math.js` | Deck, shuffle, hand evaluation. Pure; no DOM, no state |
| `02-support-systems.js` | Faces, `Store` (localStorage), settings, sound, haptics, `BUILD_VERSION` |
| `03-opponents.js` | The AI: personalities, `aiDecide()` |
| `04-modes-and-scoring.js` | Formats, blinds, the Career event catalogue, scoring |
| `05-game-engine.js` | The game state machine: `game`, `newGame()`, `applyAction()`, the hand lifecycle |
| `06-presentation.js` | Rendering and animation only (`render()`); never changes poker state |
| `coin-world.js`, `coin-table.js`, `coin-bank.js`, `bank-load.js` | Chips: the coin physics, the pot, your bank and how it fills |
| `07-ui-wiring.js` | Screen changes, and all Career money and transactions |
| `career-hub-live.js`, `career-motion-live.js`, `ticket-feed.js` | The Career Hub, its motion and the buy-in |
| `machine-wheel.js`, `table-intro.js` | The screen-change rolls, and the table powering up |
| `08-dev-mode.js` | The DEV panel (`?dev`) |
| `09-controls.js` | `wireUI()`: the main menu and every button. Must load right after 08 |
| `home-cast.js`, `home-boot.js` | The title screen's faces, and its switch-on |
| `dashboard.js`, `table-room.js`, `enemy-cards.js` | Your console's frame, room for bets, opponents' seat cards |
| `knockout.js`, `showdown.js`, `event-tape.js` | K.O. and game over, the end of a hand, Career results |
| `crt.js`, `finishes.js`, `press-feel.js` | CRT screens, screen finishes, how every button presses |
| `dealer-deck.js`, `deal-styles.js`, `card-holder.js` | The deck, how cards fly, the lip your cards sit in |
| `action-drum.js`, `knock-check.js`, `award-key.js` | The action-key drum, knock to check, the AWARD POT key |
| `coach-set.js`, `coach-talk.js`, `coach-brain.js`, `coach-lines.js`, `coach-report.js` | P.I.P.: his TV, his voice, his judgement, his lines, his report |
| `tutorial.js` | The first-run tour |
| `workshop-rack.js`, `workshop.js` | Settings and the Workshop (skins) |
| `save-data.js` | Settings → Save data: back up, restore, reset stats, start over |

Stylesheets in `css/` share these names. `01-` to `06-` are the base
layers, and `career-hub-cabinet.css` and `result-cabinet.css` lay out the
Hub and the end screens.

## Everything else

| Where | What |
| --- | --- |
| `*-lab.html` (root) and their `*-lab*.js/css` | Labs: prototyping pages, never shipped. Finished ones are archived (`CODEMAP.md`, "Archived labs") |
| `pattern-book.html`, `docs/ui/PATTERN_BOOK.md` | The visual rule book |
| `validation/*.js` | `npm test` runs them all; one suite per feature. `validation/tools/` holds the play-test, the touch harness and the AI and event simulators |
| `art-source/` | The owner's original art; the game does not load it |
| `docs/` | Rules, plans, history: [`docs/README.md`](README.md) says which are current |

## Saved data (never rename or reformat)

`felt.settings`, `felt.stats`, `felt.table`, `felt.career`,
`felt.career.table`, `felt.arcade`, `felt.finishes`,
`felt.gameplay.metrics.v1`, `pip.coach`.

A new saved key also joins `SaveData.KEYS` (`js/save-data.js`) so backups
carry it; `save-data-checks.js` fails until it does.
