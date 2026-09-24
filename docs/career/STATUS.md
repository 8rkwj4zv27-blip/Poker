# Career Mode — Current Status

This is the short handoff file: current build, what's actually shipped, and
the one concrete next task. Full milestone write-ups, superseded plans and
old phase records live in `HISTORY.md` — read that only to research how
something specific was built or decided, never by default.

## Current build

- Build marker: `v0.39.2-dev · Career Cabinet` (main-menu footer / DEV panel).
- Service-worker cache: `poker-v39-2`.
- Career save schema: **version 6**.
- Production Career Hub: ticket-reader presentation (six-venue rack,
  spring-driven touch physics, printed-ticket detail flip), integrated
  2026-09-23, with a Home→Career→table motion pass on top (2026-09-24).

## Where we are

The playable Career spine — all six venues, the Upper Ladder catalogue,
named residents with stable rosters, the Back Room cash table, Second
Chance recovery, scoring, and the Poker Faces V2 / ticket-reader
presentation — is complete and live. The most recent work was these
presentation-only passes over the Career Hub and its transitions:

1. **Tactile event rack + buy-in roll** — the ticket rack got real touch
   physics (finger pull, lean, multi-card flicks) and buy-in got an actual
   transition to the table (`careerDepartToTable()`, previously referenced
   but never defined, so every arrival was a hard cut).
2. **Lift-over swap + shimmer fix** — owner feedback on pass 1: tickets
   shimmered while moving (a per-frame CSS filter was re-rasterising on
   iOS) and the card swap felt like a fade-and-pop. Fixed with an
   opacity-only shade layer and a proper lift-over-then-lay-down swap.
3. **Machine Wheel V2** — the Home->Career, Career->table and table<->results
   rolls now run on one pixel-snapped drum engine (`js/machine-wheel.js`):
   wind-up, visible ratchet, overshoot and settle, stepped house lights.
   Settings chosen by the owner in `wheel-v2-lab.html`: FULL machinery,
   bolts off, 3px grain, standard weight, high overshoot, hum on.
4. **Ticket feed + Table Intro** (2026-09-24, auditioned in
   `intro-lab.html`). Buy-in: the ticket narrows to the intake mouth, is
   ratcheted into it, and the cabinet shudders and grinds as the bankroll
   counts down; the ticket never returns to the rack (`js/ticket-feed.js`,
   via a guarded `careerTicketFeed` hook in `career-hub-live.js`). Arrival:
   stepped lights, the same ticket slides across the felt stamped ENTRY
   PAID, a clockwise seat roll call, chip stacks drop into the bank, pot
   tray and deck (`js/table-intro.js`, every table entry incl. Single
   Player and resume). Owner cut: no seat style labels, no paper shreds.

5. **Home Boot** (2026-09-24, outside Career — main menu). The menu
   powers up on a cold launch (`js/home-boot.js`, replay in
   `boot-lab.html`); the title-glass tap Easter egg was removed at the
   owner's request. v0.39.1: the House Faces drop in and have
   temperaments (`js/home-cast.js`). v0.39.2: Career Hub layout pass —
   Back/Settings on the top rail, no bottom strip, roomier tickets, brass
   ticket slot (`css/career-hub-cabinet.css`). Next main-menu passes discussed with the owner:
   top-bar clean-up, counter-drum stats, pokeable House Faces, live
   readout ticker, then the sub-screens.

Full detail for the first two is in `HISTORY.md` under the 2026-09-24 entries. No
Career transaction, save field, catalogue, roster, poker or AI code changed
in any of these passes; the DETAILS card flip is untouched.

## Scope note — Phase 5/7/8 shelved (2026-09-24)

The owner does not currently want:

- **Phase 5's contextual selection logic** (Recommended / Alternative /
  Next Target cards). The Full Circuit half of Phase 5 already shipped as
  part of the ticket-reader Hub — all six venues are visible with real
  state — so that need is already met without the smart-selection layer.
- **Phase 7** (named-resident relationship counters, dossiers) or
  **Phase 8** (a boss seat and first-clear ceremony). Career has no boss
  encounter today and none is wanted for now.

This supersedes those two rows of the old phase table (see `HISTORY.md`)
until the owner asks for them again. It's recorded here (and in
`CAREER_DESIGN.md`) so a future session doesn't default back into building
either.

## Immediate next task

**Owner on-device (iPhone/PWA) feel review** of the Hub polish above: swipe
weight, flick reach, the lift-over swap, and the buy-in roll length (~3s,
skippable once paid). Tune from that feedback. No new Career system or
venue work is scheduled until the owner asks for it — see the scope note.

## How to test

```
node validation/career-events-checks.js     # 112 checks
node validation/career-result-checks.js     # 41 checks
node validation/scoring-checks.js           # 170 checks
node validation/holiday-gameplay-checks.js  # 20 checks
node validation/quick-bet-checks.js         # 14 checks
```

For a rendered/touch check in a browser (no device required), see
`validation/tools/README.md` — a small Playwright harness drives real touch
events against a local server and can save a screenshot contact sheet.

`card-flight-checks.js`, `card-turn-checks.js`, `chip-motion-checks.js` and
`showdown-rail-checks.js` assert `BUILD_VERSION`/`CACHE_NAME` stay in
numeric sync (e.g. `v0.36.2-dev` ↔ `poker-v36-2`) rather than a frozen
historical string, so they no longer go stale on every version bump.

## Working decisions still to validate

- The three-buy-in Comfortable / Risky bankroll thresholds.
- Second Chance's $150 payout and its emotional effect / exploit potential
  (unobserved — needs real playtesting).
- Upper-tier economy, event durations, and the 4–8 hour career-length
  target (all provisional, unmeasured).
- Career pacing has bounded local measurement only; no further stack-depth
  or cadence change is justified yet.

## Not implemented

Contextual board selection, career records/dossiers/trophies/titles, boss
seats, cosmetics, satellites, and Card Club-and-above gameplay balancing —
see `HISTORY.md`'s "Not implemented" and phase-table entries for the full,
dated list. Nothing above is scheduled — see the scope note.

## Handoff protocol

At the end of any Career task:

1. Record what changed here, under "Where we are".
2. Set one concrete "Immediate next task".
3. Record tests run and their result.
4. If this file is getting long again, move older entries into
   `HISTORY.md` and keep this file to current state + next task only.
5. Move any changed product decision into `CAREER_DESIGN.md` and explain
   why.
