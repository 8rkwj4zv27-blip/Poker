# Handover

The note one session leaves for the next. **Read this first; update it last**,
in the same pull request as the change (rules in `CLAUDE.md`, "Handover
note"). Keep it to one screen: replace old lines rather than adding to them.
If this note and the code disagree, the code wins.

Build: `v0.69.0-dev · New Career in the game`
Updated: 13 October 2026 (v0.69.0: Career opens the new hub)

## Where the game is

All of it is live and played on the owner's iPhone: Quick Deal (the
endless table run, called "Single Player" in code) and Custom Game, which
the owner rarely uses; Career, which the owner thinks of as *the* game:
since v0.69.0 the new Career (invitation cards, packets, the hub; its own
save) by default, the classic one (six venues, the ticket-reader Hub,
buy-in feed, Table Intro, end screens) under Settings → Career; opponents with personalities, moods and sparse table
talk; P.I.P. the coach (tap only, with the end-of-hand report); Settings and
the Workshop (skins); save data (back up, restore, start over).

Play-test and all 25 suites passed on v0.69.0 (13 Oct). Checked on 8 Oct (v0.67.0): all 25 test suites
and the play-test pass; a real Career buy-in to the new 5-HAND, hands,
reload and CONTINUE work. On 7 Oct the table, dashboard, showdown, Home and
Career Hub all rendered cleanly. The 25 Sept visual
audit's complaints (dashboard rims, clipped result line, chip pile) are gone.

## Recent changes (newest first)

- 13 Oct (v0.69.0): the new Career in the game: Career opens the hub on a
  fresh save of its own; Settings → Career goes back to the classic one.
  The v0.68.0 home-screen copy (`new-career/`) and the preview lab are gone.
- 13 Oct (v0.68.0): New Career (preview): hub, shop, album on a real
  save, ten sample events, packets (first as a separate home-screen app).
- 12 Oct (DEV only, no release): Career invitations, Stage 1
  ([plan](career/INVITATIONS_PLAN.md)): a 3-player, 10-hand Back Room
  invitation from DEV, HAND n/10, ties shared, paid once; card preview
  `invitation-cards-lab.html`: https://claude.ai/artifact/K4NmPQASrYC6RoJLepPRP2
- 12 Oct (no game change): the card album (`collection-book-lab.html`,
  [plan](career/COLLECTION_BOOK_PLAN.md)): a leather-bound book, 3 × 3; hold a card into the reader.

## Open items (verified, not scheduled)

- New Career (v0.69.0 review): no ABANDON for an event in progress (only
  CONTINUE); Settings over the hub can offer "Reset current run" for a
  Quick Deal save; the opening reads sound/motion/haptics once per load;
  `invitation-scenario.js` and `career-hub-scenario.js` assume CLASSIC.
- Career: reloading between hands replays the hand just finished (the
  end-of-hand save is its start checkpoint; never counted twice).
- The owner's notes on the wooden-table hub with the packet machine: https://claude.ai/artifact/WKWLooBRqQNJGYqfbDf1B1
  (home screen: https://8rkwj4zv27-blip.github.io/Poker/packet-machine/, once merged; re-stage it with each change)
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

**Career is moving to invitations** (owner, 12 Oct). Stages 1-5 of
[`career/INVITATIONS_PLAN.md`](career/INVITATIONS_PLAN.md) are live: the
new Career is the default Career (v0.69.0). Next: the owner's verdict from
the phone, the economy simulated, the Pattern Book sign-off for the hub's
parts, then the special-rules events. Workflow: [`WORKFLOW.md`](WORKFLOW.md).
