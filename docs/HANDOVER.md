# Handover

The note one session leaves for the next. **Read this first; update it last**,
in the same pull request as the change (rules in `CLAUDE.md`, "Handover
note"). Keep it to one screen: replace old lines rather than adding to them.
If this note and the code disagree, the code wins: fix the note.

Build: `v0.67.0-dev · Back Room builds a stack`
Updated: 8 October 2026

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

- v0.67.0 The Back Room builds a stack (Events Release 1): a new 5-HAND
  Top-2 ticket, 1,000-chip stacks, blinds every 15 hands, opponents at
  skill 20 (events now carry a `skill`). Tickets already bought keep
  their terms.
- 8 Oct (no game change): the events rework planned with the owner
  (`docs/career/EVENTS_PLAN.md`); `validation/tools/event-sim.js` plays
  whole Career events to measure it.
- v0.66.1 Tab reads just "Poker Faces", with the new icon.
- v0.66.0 Developer Mode hidden unless `?dev` is in the address.
- 7 Oct (no game change): this handover note; stale docs marked
  Historical; 8 shipped labs archived (`CODEMAP.md`, "Archived labs").

## Open items (verified, not scheduled)

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

The owner plays the new Back Room on the phone (v0.67.0): does it build a
stack, do events feel too long (minutes per hand are unmeasured)? Then
Events Release 2, the heat gauge lab (`docs/career/EVENTS_PLAN.md`), then
venue ladders and new formats, in that order. The owner wants fancier tickets by tier and a
venue-change moment later; don't start those before the ladders.
