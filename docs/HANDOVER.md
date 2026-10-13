# Handover

The note one session leaves for the next. **Read this first; update it last**,
in the same pull request as the change (rules in `CLAUDE.md`, "Handover
note"). Keep it to one screen: replace old lines rather than adding to them.
If this note and the code disagree, the code wins.

Build: `v0.70.0-dev · New Career polish`
Updated: 13 October 2026 (v0.70.0: the New Career polish pass)

## Where the game is

All of it is live and played on the owner's iPhone: Quick Deal (the
endless table run, called "Single Player" in code) and Custom Game, which
the owner rarely uses; Career, which the owner thinks of as *the* game:
since v0.69.0 the new Career (invitation cards, packets, the hub; its own
save) by default, the classic one (six venues, the ticket-reader Hub,
buy-in feed, Table Intro, end screens) under Settings → Career; opponents with personalities, moods and sparse table
talk; P.I.P. the coach (tap only, with the end-of-hand report); Settings and
the Workshop (skins); save data (back up, restore, start over).

Checked 13 Oct (v0.70.0): all 25 suites (`npm test`) and the seven
browser checks (`npm run browser-checks`: the play-test, the new Career
scenario, the lab suites) pass.

## Recent changes (newest first)

- 13 Oct (v0.70.0): the New Career polish pass (Stage 6 of the
  [plan](career/INVITATIONS_PLAN.md)): the hub on its own screen, every
  move on the drum (shop included); one result stage for every invitation
  finish; the result on the hub; ABANDON; starter and pity wrappers; the
  safe area; MORE replaces the lab's TUNE; the economy simulated; the CRT
  and pack labs and `packet-machine/` archived; browser checks on GitHub.
- 13 Oct (v0.69.0): the new Career in the game: Career opens the hub on a
  fresh save of its own; Settings → Career goes back to the classic one.
  The v0.68.0 home-screen copy (`new-career/`) and the preview lab are gone.
- 13 Oct (v0.68.0): New Career (preview): hub, shop, album on a real
  save, ten sample events, packets (first as a separate home-screen app).
- 12 Oct (DEV only): invitations Stage 1, a 10-hand Back Room from DEV;
  cards: https://claude.ai/artifact/K4NmPQASrYC6RoJLepPRP2

## Open items (verified, not scheduled)

- New Career: the opening reads sound/motion/haptics once per load (a
  Settings change applies after a reload); packets added to a felt that
  already has one can land on it; lab-only code still ships inside
  `pack-opening.js` and `vending-machine.js` (unreachable in the game).
- New Career economy (`validation/tools/invitation-economy.js`, results
  in the plan's Stage 6): money has no sink but the $150 House Packet.
- Career: reloading between hands replays the hand just finished (the
  end-of-hand save is its start checkpoint; never counted twice).
- Career Hub on small iPhones (375x667, SE/8): BUY IN sits below the
  screen. Fine on the owner's Pro Max.
- Stale code comments still name archived labs or say "not loaded by the
  game" (`js/coach-report.js`, `css/coach-report.css`, `js/bank-load.js`).
  Fix them in the next release that touches those files.
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

**Career is moving to invitations** (owner, 12 Oct). Stages 1-6 of
[`career/INVITATIONS_PLAN.md`](career/INVITATIONS_PLAN.md) are live (the
polish pass, v0.70.0). Next: the owner's verdict from the phone, then the
forward plan's decisions (the new Career's goal: album and packet tiers
recommended; retiring the classic Career; the catalogue's size), priced
from the economy simulation; the Pattern Book sign-off for the hub's
parts; then the special-rules events. Workflow: [`WORKFLOW.md`](WORKFLOW.md).
