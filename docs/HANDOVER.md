# Handover

The note one session leaves for the next. **Read this first; update it last**,
in the same pull request as the change (rules in `CLAUDE.md`, "Handover
note"). Keep it to one screen: replace old lines rather than adding to them.
If this note and the code disagree, the code wins.

Build: `v0.67.1-dev · Hub hooks for the deck and P.I.P.`
Updated: 11 October 2026 (isolated lab only)

## Where the game is

All of it is live and played on the owner's iPhone: Quick Deal (the
endless table run, called "Single Player" in code) and Custom Game, which
the owner rarely uses; Career, which the owner thinks of as *the* game
(six venues, the ticket-reader Hub, buy-in feed, Table
Intro, end screens); opponents with personalities, moods and sparse table
talk; P.I.P. the coach (tap only, with the end-of-hand report); Settings and
the Workshop (skins); save data (back up, restore, start over).

Play-test passed on v0.67.1 (11 Oct). Checked on 8 Oct (v0.67.0): all 25 test suites
and the play-test pass; a real Career buy-in to the new 5-HAND, hands,
reload and CONTINUE work. On 7 Oct the table, dashboard, showdown, Home and
Career Hub all rendered cleanly. The 25 Sept visual
audit's complaints (dashboard rims, clipped result line, chip pile) are gone.

## Recent changes (newest first)

- 11 Oct (no game change): the packet machine, round 3 (owner's notes):
  TUNE fix, select then add, a chip stream, a flat tray; the hub loses
  P.I.P., gains a clean-up spot, one table size, a bag of chips to snip.
- 11 Oct (no game change): the shop is a vending machine (owner's idea,
  [plan](career/VENDING_PLAN.md)), moving: `vending-lab.html`.
- 11 Oct (no game change): the desk lab ([plan](career/CAREER_HUB_DESK_PLAN.md))
  was rejected; stills of a simpler hub became `career-main-lab.html`:
  the table's deck deals cards, P.I.P. to tap or throw (v0.67.1 hooks).
- 11 Oct (no game change): Pack Opening V3 (`pack-opening-lab.html`,
  [plan](career/PACK_OPENING_V3_PLAN.md)): the packet, the reveal, the haul,
  a polish pass; then one shared card inspect screen (`js/card-inspect.js`,
  simplified on the owner's notes) used by the pack, album and hub.
- 8 Oct (no game change): Hub Lab (`hub-lab.html`): Career opens on
  tonight's tickets, dealt and styled by kind, fed into a slot.

## Open items (verified, not scheduled)

- The owner's notes on the moving packet machine: https://claude.ai/artifact/WKWLooBRqQNJGYqfbDf1B1
  (home screen: https://8rkwj4zv27-blip.github.io/Poker/packet-machine/, on main; re-stage it with each change)
- The owner's verdict on the moving hub: https://claude.ai/artifact/FpUrE7DTH5uqFqhV4eC8ir
  (and the pack lab: https://claude.ai/artifact/2A5hyH5pufRp7Tdj513SQp)
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

The packet machine and hub: the owner's notes on round 3, then polish.
Then the collection book; then into Career: the collection save, a pack economy
simulation, Pattern Book sign-off for the new parts, the real table hand-off.
Read [`career/CAREER_HUB_DESK_PLAN.md`](career/CAREER_HUB_DESK_PLAN.md) and
[`career/PACK_OPENING_V3_PLAN.md`](career/PACK_OPENING_V3_PLAN.md).
(It supersedes the Hub Lab's ticket rack.) Agree with the owner how this reshapes Events Releases 2 to 4
(`docs/career/EVENTS_PLAN.md`) before building either. Still open: the
owner's verdict on the new Back Room (v0.67.0; minutes per hand unmeasured).
