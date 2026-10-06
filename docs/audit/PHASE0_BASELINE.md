# Phase 0 baseline (audit, 5 Oct 2026)

The yardstick for the codebase tidy-up. Every Phase 2 pull request is run
against these numbers before and after. The full audit report (findings F1–F8,
the folder proposal, the Phase 2 plan and the owner's decisions) is a shared
doc: https://claude.ai/code/artifact/84fe5689-ff5e-4deb-8e99-0d76cd01ef3d

Measured on `main` at `d4a0ea3` (v0.64.4). Nothing in the game was changed.

## Failsafe: the pre-audit checkpoint

Branch `checkpoint/pre-audit-v0.64.4` points at `d4a0ea3`: the whole game
exactly as it was before any clean-up. **Never push to it, rebase it or
delete it.** (It is a branch, not a tag, because this environment can only
create branches; the owner can protect it on GitHub.)

- **Undo one PR:** the Revert button on its merged pull request on GitHub.
- **Return everything to the checkpoint** (no force-push, history kept):

  ```
  git switch -c restore-pre-audit origin/main
  git rm -r -q . && git checkout origin/checkpoint/pre-audit-v0.64.4 -- .
  git commit -m "Restore the pre-audit checkpoint (v0.64.4)"
  git diff origin/checkpoint/pre-audit-v0.64.4 --stat   # must print nothing
  ```

  then open and merge that branch as a pull request. GitHub Pages redeploys
  from `main`, and installed phones pick it up on their next online launch
  (`sw.js` is network-first).
- **Rehearsed 5 Oct 2026:** two engine files deleted, `index.html` broken and
  junk added on a throwaway copy, then restored with the steps above: zero
  differences from the checkpoint; scoring, Career events, showdown and
  pot-shape suites pass; the play-test plays full hands.
- **Saved data on a phone is not in git.** It is protected by the rule that
  no change renames or reformats the 9 keys below, and by loading an old
  build's save after every change that touches live files.

## Other backup branches

All three `checkpoint/` branches are protected on GitHub. Never push to them
or delete them.

| Branch | What it keeps | Get something back |
| --- | --- | --- |
| `checkpoint/pre-audit-v0.64.4` | The whole game before the audit (above) | The steps above |
| `checkpoint/labs-archive-2026-10` | The 23 finished labs archived in audit PR 5, and the files only they used | `git checkout origin/checkpoint/labs-archive-2026-10 -- <file>` (`docs/CODEMAP.md` lists them) |
| `checkpoint/old-branches-2026-10` | The ten superseded branches deleted in the audit's GitHub tidy (8 from before `main`'s history restart on 24 Sept, plus `wizardly-noether` and `pass-3a-checkpoint`) | Its one commit has the same files as `main`; the ten branches' last commits are its extra parents, listed with their names in its message. `git log -1 origin/checkpoint/old-branches-2026-10`, then `git checkout -b <name> <sha>` |

Two unmerged branches stay live on purpose: `claude/tender-dijkstra-zso8dm`
(the Speech Lab, which `docs/coach/COACH_PLAN.md` refers to) and
`claude/sweet-pasteur-6yard0` (Skin Lab). Every other `claude/` and `codex/`
branch was already merged into `main`, so deleting it loses nothing.

## Test suites

`node validation/<suite>.js`, about 4 minutes for all 21.

| Result | Suites |
| --- | --- |
| Pass (20) | ai-behaviour, ai-tier, card-flight, card-flight-options, card-turn, career-events, career-result, chip-motion, coach-brain, coach-reliability, coach-tactics, dealer-deck, event-tape, holiday-gameplay, pattern-book (28), pot-shape, quick-bet, scoring-audit (0 divergences), scoring (170), showdown |
| Fail (1) | showdown-rail: `showdown-rail-lab.html`'s embedded copy of the table still has the Coach/Review panels removed from `index.html` in v0.55.2 (finding F3). Pre-existing. |

## iPhone play-test

Real game, `validation/tools/touch-harness.js`, real touch taps, full hands.

| Viewport | Hands | JS errors | Horizontal overflow |
| --- | --- | --- | --- |
| 390 × 844 | 3 | 0 | 0 |
| 430 × 932 | 2 | 0 | 0 |
| 320 × 700 | 1–2 | 0 quiet; 27 under CPU contention | 0 |

Under contention, 2 of about 25 runs threw errors from `revealHoleCardsAnimated`
(`js/05-game-engine.js:943`), `handleFoldWin` (`:1562`) and `findNextActor`
(`:642`): a hand sequence running on table state that changed under it.
Trigger not yet pinned (finding F1). It recurred once more (68 errors) on
the restored checkpoint during the failsafe rehearsal, so it predates the
audit.

## Saved data (must survive every change)

`felt.settings`, `felt.stats`, `felt.table`, `felt.career`,
`felt.career.table`, `felt.arcade`, `felt.finishes`,
`felt.gameplay.metrics.v1`, `pip.coach`.

## Live-file map

- `index.html` loads 83 files (42 JS, 38 CSS, manifest, 2 icons).
- `sw.js` `APP_SHELL` holds 139: those 83, plus `./`, `index.html`,
  `icon-512.png` and 53 faces. In sync: no missing files, no `?v=` mismatches.
- 97 files in `js/` and `css/` are lab-only (31.6k lines); 80 are live.

## Other facts

- Correctness lint (ESLint, throwaway config) over the 42 live scripts: 0 defects.
- `evaluate5` over all 2,598,960 five-card hands matches the published
  category totals exactly (8 s).
- First-visit download: 4.8 MB, 138 files.
