# Career Mode — Current Status

Career's own handoff: what's shipped in Career and its next task. The
whole game's build, recent changes and open items live in
`docs/HANDOVER.md`; read that first. Full milestone write-ups, superseded
plans and old phase records live in `HISTORY.md` — read that only to
research how something specific was built or decided, never by default.

## Current state

- Last checked: 7 October 2026, against v0.66.1. Since v0.64.4 (Abandon /
  Cash Out on the paid ticket) Career's only changes are the audit's file
  tidy and save data (v0.65.0), which backs up and restores the Career
  save without changing its fields.
- Career save schema: **version 6** (`CAREER_SAVE_VERSION`).
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
   Back/Settings on the top rail, no bottom strip, roomier tickets
   (`css/career-hub-cabinet.css`). v0.39.3: the slot is a readout slot in
   one dark console with the button (picked in `slot-lab.html`). Owner
   wants a further Career Hub spacing pass next, then a written visual
   language guide (`docs/ui/VISUAL_LANGUAGE.md`) that future work must
   follow or ask to break. Next main-menu passes discussed with the owner:
   top-bar clean-up, counter-drum stats, pokeable House Faces, live
   readout ticker, then the sub-screens.

6. **Visual audit + fix pass** (2026-09-25, v0.40.1). A whole-game visual
   audit (`docs/ui/VISUAL_AUDIT.md`, findings F1-F21) and a fix pass of
   everything that wasn't a design decision: pixel-font ligatures ("fi"
   drew as "A"), hand-log grammar, the all-in banner, pot/side-pot names
   (labels and log only), first-run card timing, pot plate vs deck,
   showdown lane on the board row, reward text over a dark band, result
   stages / Home / Custom Game / ticket DETAILS fitting standard and SE
   phones, Hub bankroll-rail spacing, a tidied Settings sheet, and the
   back paths (Career->Home, Back to Events, Leave table) turning the
   Machine Wheel the other way. The player dashboard was deliberately left
   alone. What's left is the **V2 design pass** list in the audit.

7. **End screens** (2026-09-30, v0.58.0, `docs/ui/END_SCREENS_PLAN.md`,
   in `end-screens-lab.html` for the owner). EVENT WON / EVENT LOST's
   RESULT well is the event's story: chip tape, bust-out order, best hand,
   luck meter. **New Career table-save field** `tape` (display data only,
   owner-approved; old saves start a fresh tape). After a bust the wreck
   stays under the result, the drum limps round to BACK TO EVENTS, and
   P.I.P. is blown to the moon. No settlement, bankroll, poker or AI code
   changed.

Full detail for the first two is in `HISTORY.md` under the 2026-09-24 entries. No
Career transaction, save field, catalogue, roster, poker or AI code changed
in any of these passes; the DETAILS card flip is untouched.

8. **Events Release 1: the Back Room builds a stack** (2026-10-08,
   v0.67.0, `EVENTS_PLAN.md`). A new `back-room-five` ticket (5 players,
   $100, pays $350/$150); the 3-HAND, HEADS-UP and Second Chance move to
   deeper stacks and slower blinds; every Back Room event carries
   `skill:20`, which `aiSkillOf` reads from the table's event. Snapshots
   carry the skill, so a ticket bought before keeps its old terms. A v6
   save from before the new ticket migrates with every field kept
   (`career-events-checks.js`, now 115 checks).

9. **Isolated Event Card Visual System Lab** (2026-10-09, no release):
   owner-approved three-card experiment in `event-card-lab.html`, with
   independent rarity, gameplay category and venue layers, a consistent
   artwork aperture, larger inspection and reader-only return. Separate
   rendered Gauntlet plus one correction pass at four phone sizes.
   `npm test`: 26/26 suites passed, including 150 lab checks; real touch,
   reduced motion, keyboard and persistent-storage isolation verified.
   Awaiting owner review; no production Career/poker/save/navigation
   changes. Details and screenshots: `EVENT_CARD_LAB.md`.

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

**Owner reviews the Event Card Visual System Lab** (`event-card-lab.html`,
`EVENT_CARD_LAB.md`): approve or revise its shared construction and
independent rarity/category/venue layers. No merge or production
integration approved. The earlier Hub Lab and later Vendor / Case remain
the wider packs exploration; agree how this reshapes Releases 2 to 4
below before implementing them.

Before that, still open: **owner plays Release 1 on the phone** (v0.67.0, `docs/career/EVENTS_PLAN.md`):
does the Back Room build a stack, and are its longer events still fun?
Time a few real events (minutes per hand is unmeasured). Then **Release
2, the heat gauge**: a phone-first lab for a needle meter on the ticket
reader that reads an event's `skill`. Releases 3 and 4 (venue ladders,
new formats) follow in that order. Also open:
BUY IN below the screen on small iPhones (375x667), in `docs/HANDOVER.md`.

## How to test

```
node validation/career-events-checks.js     # 115 checks
node validation/career-result-checks.js     # 44 checks
node validation/event-tape-checks.js        # 15 checks
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
- Stack depth and blind pace: measured with `event-sim.js` on 8 Oct 2026
  and changed by the owner's decision (`EVENTS_PLAN.md`). Minutes per hand
  on the phone are still unmeasured.

## Not implemented

Contextual board selection, career records/dossiers/trophies/titles, boss
seats, cosmetics, satellites, and Card Club-and-above gameplay balancing —
see `HISTORY.md`'s "Not implemented" and phase-table entries for the full,
dated list. Satellites and venue balancing are now scheduled in
`EVENTS_PLAN.md` (Releases 3 and 4); the rest stays unscheduled — see the
scope note.

## Handoff protocol

At the end of any Career task:

1. Record what changed here, under "Where we are".
2. Set one concrete "Immediate next task".
3. Record tests run and their result.
4. If this file is getting long again, move older entries into
   `HISTORY.md` and keep this file to current state + next task only.
5. Move any changed product decision into `CAREER_DESIGN.md` and explain
   why.
