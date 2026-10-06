# Changelog

Every release of Poker Faces, newest first. The version shows in the main
menu's footer (`BUILD_VERSION`, `js/02-support-systems.js`) and in the
offline cache name (`CACHE_NAME`, `sw.js`). Dates are when the release
reached `main`. Releases before v0.39.8 are recorded in
`docs/career/HISTORY.md`.

## Unreleased: codebase audit (no change to the game)

- Phase 0 baseline and the pre-audit checkpoint branch
  `checkpoint/pre-audit-v0.64.4` (`docs/audit/PHASE0_BASELINE.md`).
- `npm test` runs every suite; GitHub runs it on every pull request.
- New suites: offline-list checks (`index.html` vs `sw.js`) and hand
  evaluation against all 2,598,960 five-card hands.
- `npm run play-test`: real hands, real taps, three iPhone sizes.
- README, this changelog, LICENSE, a docs index; `AGENTS.md` now points to
  `CLAUDE.md`.
- Unused art out of `assets/`: the old chip images deleted; the owner's
  blue, purple and yellow face sets kept as originals in `art-source/faces/`.
- 23 finished labs and the 75 files only they used (23,606 lines) archived
  to the protected branch `checkpoint/labs-archive-2026-10`.

## v0.64 — 5 and 6 October 2026

- **v0.64.6** Dead code out, no change in play: the retired Hand Review panel's `showReview()` and three other uncalled functions, 12 unused inner helpers and 23 unused variables removed; stale code comments corrected.
- **v0.64.5** Honest file names, no change in play: the game's controls (`wireUI()`) move from `08-dev-mode.js` to their own `09-controls.js`, and the live Career Hub stylesheet loses "lab" from its name (`career-hub-v2.css`).
- **v0.64.4** Career hub: Abandon / Cash Out moves onto the paid ticket.
- **v0.64.3** One cabinet: menu screens and Settings match the main menu's size.
- **v0.64.2** The bank rack stops jumbling after a bet.
- **v0.64.1** The main menu no longer scrolls: the cabinet scales to fit the phone.
- **v0.64.0** Bank load: Count in (default) and Tray in, chosen in Workshop → Bank.

## v0.63 — 5 October 2026

- **v0.63.0** End screens: chip tape, bust-out order, the wreck stays, P.I.P. to the moon.

## v0.62 — 5 October 2026

- **v0.62.2** P.I.P. names your hand on a close call; the tour waits for him.
- **v0.62.1** A resumed hand deals the same cards.
- **v0.62.0** Friends-test pass: the tour, the Continue key, no lives or rebuys, 6-seat fixes.

## v0.61 — 4 October 2026

- **v0.61.0** Workshop skins: chip skins, card faces and four new screen looks.

## v0.60 — 4 October 2026

- **v0.60.1** Workshop fixes: the home cabinet fits; Showdown hold-to-smash.
- **v0.60.0** Settings and the Workshop arrive in the game; a bigger Showdown preview.

## v0.59 — 4 October 2026

- **v0.59.0** The P.I.P. report: an end-of-hand breakdown with a grade.

## v0.58 — 4 October 2026

- **v0.58.9** P.I.P. in plain words: no percentages until they're taught.
- **v0.58.8** P.I.P. accuracy audit, and tap-only P.I.P.

## v0.57 — 29 September to 4 October 2026

- **v0.57.6** P.I.P. is tap only.
- **v0.57.5** P.I.P. accuracy audit: full games checked against the rules.
- **v0.57.4** Bets round to nice numbers and stop at what can be called.
- **v0.57.3** Pick P.I.P. up and throw him round the screen.
- **v0.57.2** A new cache tag for `02-support-systems.js`.
- **v0.57.1** P.I.P. on time, and taps that move on.
- **v0.57.0** P.I.P. in plain English: betting, bluffing, reading the table and timing.

## v0.54 to v0.56 — 29 September 2026

- **v0.56.0** P.I.P. after the flop: calling and folding when you face a bet.
- **v0.55.2** The old Coach panel retires; P.I.P.'s key shows his face.
- **v0.55.1** P.I.P. advises before you act; tap his screen for his read.
- **v0.55.0** P.I.P. judges your decisions before the flop.
- **v0.54.0** The Coach, plugged in.

## v0.47 to v0.53 — 28 September 2026

- **v0.53.1** A clean smash.
- **v0.53.0** Opponents who play like people (the AI rebuild).
- **v0.52.0** Table room.
- **v0.51.4** One deal style a hand.
- **v0.51.3** The menu shows the build that's installed.
- **v0.51.2** Flying cards are visible again.
- **v0.51.0** Deal styles.
- **v0.50.0** NEXT HAND on the drum, and the award key.
- **v0.49.0** Card holder.
- **v0.48.0** Action drum.
- **v0.47.0** Felt.

## v0.43 to v0.46 — 27 and 28 September 2026

- **v0.46.0** Chips.
- **v0.45.0** Dealer deck.
- **v0.44.1** A taller pyramid pot; opponents' wins fly straight home.
- **v0.44.0** Gold economy.
- **v0.43.0** Coin denominations and the bank.

## v0.40 to v0.42 — 24 to 27 September 2026

- **v0.42.2** The pot tidies into shapes, coins on a grid, kept in the tray.
- **v0.42.0** K.O. and game over.
- **v0.41.0** Enemy Cards V2.
- **v0.40.8** Small tables sit right; bets never land on cards.
- **v0.40.7** Table spacing pass, release 2.
- **v0.40.6** The XP system is shelved: no score, awards, pot smash or high score.
- **v0.40.5** The bank rack always matches your stack.
- **v0.40.4** Fix the table freezing on entry after the coin release.
- **v0.40.3** Gold coins in the game.
- **v0.40.2** Dashboard V2, release 1.
- **v0.40.0** Every CRT screen rebuilt on one component.

## v0.39 — 24 September 2026

- **v0.39.9** CRT glow sized to the text, and toned down.
- **v0.39.8** CRT screens: the finish owns their text too.
