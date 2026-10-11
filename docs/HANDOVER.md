# Handover

The note one session leaves for the next. **Read this first; update it last**,
in the same pull request as the change (rules in `CLAUDE.md`, "Handover
note"). Keep it to one screen: replace old lines rather than adding to them.
If this note and the code disagree, the code wins.

Build: `v0.67.0-dev · Back Room builds a stack`
Updated: 11 October 2026 (isolated lab only)

## Where the game is

All of it is live and played on the owner's iPhone: Quick Deal (the
endless table run, called "Single Player" in code) and Custom Game, which
the owner rarely uses; Career, which the owner thinks of as *the* game
(six venues, the ticket-reader Hub, buy-in feed, Table
Intro, end screens); opponents with personalities, moods and sparse table
talk; P.I.P. the coach (tap only, with the end-of-hand report); Settings and
the Workshop (skins); save data (back up, restore, start over).

Checked on 8 Oct 2026 (v0.67.0) on emulated iPhones: all 25 test suites
and the play-test pass; a real Career buy-in to the new 5-HAND, hands,
reload and CONTINUE work. On 7 Oct the table, dashboard, showdown, Home and
Career Hub all rendered cleanly. The 25 Sept visual
audit's complaints (dashboard rims, clipped result line, chip pile) are gone.

## Recent changes (newest first)

- 11 Oct (no game change): Pack Opening V3 (`pack-opening-lab.html`,
  [plan](career/PACK_OPENING_V3_PLAN.md)): the packet, the reveal, the haul,
  a polish pass; then one shared card inspect screen (`js/card-inspect.js`,
  simplified on the owner's notes) used by the pack, album and hub.
- 8 Oct (no game change): Hub Lab (`hub-lab.html`): Career opens on
  tonight's tickets, dealt and styled by kind, fed into a slot.
- 8 Oct (no game change): Career as packs of cards, brainstormed with
  the owner (`docs/career/PACKS_PLAN.md`); the visual lab `pack-lab.html`
  (vending machine, rip, reveal, ticket case, feed into a real table).
- v0.67.0 The Back Room builds a stack (Events Release 1): a new 5-HAND
  Top-2 ticket, 1,000-chip stacks, blinds every 15 hands, opponents at
  skill 20. Tickets already bought keep their terms.

## Open items (verified, not scheduled)

- Pack Opening V3 (all four slices, first polish) awaits the owner's verdict:
  https://claude.ai/artifact/2A5hyH5pufRp7Tdj513SQp
- Career Hub on small iPhones (375x667, SE/8): BUY IN sits below the
  screen. Fine on the owner's Pro Max.
- Stale code comments still name archived labs or say "not loaded by the
  game" (`js/coach-set.js`, `js/coach-talk.js`, `js/coach-report.js`,
  `css/coach-report.css`, `js/bank-load.js`). Fix them in the next release
  that touches those files, not in a release of their own.
- GitHub: about 27 merged and 19 unmerged `claude/` branches are still on
  the remote. The owner chose (7 Oct) to leave them: several unmerged
  ones are not backed up. Don't delete branches unasked.
- Rare engine errors under heavy CPU load at 320x700 (audit finding F1,
  `PHASE0_BASELINE.md`): never pinned or fixed.
- Unmeasured: minutes per hand on the phone, and the upper venues'
  economy (`docs/career/STATUS.md`).

## Parked by the owner (don't start unasked)

Career Phases 5/7/8 (smart event picks, resident relationships, boss
seats); "Ask P.I.P." question keys, P.I.P. memory and stages; opponents'
own speech bubbles (`claude/tender-dijkstra-zso8dm`).

## Next

Pack Opening V3: the owner reviews the shared inspect screen on the phone
link; then buying packs (the vending machine) and the Career hub desk.
New parts go to the Pattern Book before the game: packet canvas, squeeze,
hand fan, collection slot, the inspect screen.
Read [`career/PACK_OPENING_V3_PLAN.md`](career/PACK_OPENING_V3_PLAN.md).
Earlier pending work: the owner plays the Hub Lab (`docs/career/PACKS_PLAN.md`, Round 3: Career opens on tonight's
tickets); then the Vendor and the Case screens to the same standard.
Agree with the owner how this reshapes Events Releases 2 to 4
(`docs/career/EVENTS_PLAN.md`) before building either. Still open: the
owner's verdict on the new Back Room (v0.67.0; minutes per hand
unmeasured).
