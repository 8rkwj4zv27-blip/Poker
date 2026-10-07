# Handover

The note one session leaves for the next. **Read this first; update it last**,
in the same pull request as the change (rules in `CLAUDE.md`, "Handover
note"). Keep it to one screen: replace old lines rather than adding to them.
If this note and the code disagree, the code wins: fix the note.

Build: `v0.66.1-dev · Tab name and icon`
Updated: 7 October 2026

## Where the game is

All of it is live and played on the owner's iPhone: Single Player and
Custom Game; Career (six venues, the ticket-reader Hub, buy-in feed, Table
Intro, end screens); opponents with personalities, moods and sparse table
talk; P.I.P. the coach (tap only, with the end-of-hand report); Settings and
the Workshop (skins); save data (back up, restore, start over).

Checked on 7 Oct 2026 by playing the real game on emulated iPhones (430x932,
390x844): all 25 test suites pass, the play-test passes, and the table,
dashboard, showdown, Home and Career Hub render cleanly. The 25 Sept visual
audit's complaints (dashboard rims, clipped result line, chip pile) are gone.

## Recent changes (newest first)

- v0.66.1 Tab reads just "Poker Faces", with the new icon.
- v0.66.0 Developer Mode hidden unless `?dev` is in the address.
- v0.65.0 Save data: back up, restore, reset stats, start over.
- v0.64.7 New app icon. Before it: the codebase audit (no game change).
- 7 Oct (docs only): this handover note; stale docs marked Historical.

## Open items (verified, not scheduled)

- Career Hub on small iPhones (375x667, SE/8): BUY IN sits below the
  screen. Fine on the owner's Pro Max.
- Eight shipped labs that no test reads are still in the repo (bank-load,
  end-screens, workshop-skins, pip-report, coach-brain/face/rig/voice).
  Archiving them ("Labs don't pile up" in `CLAUDE.md`) needs the owner's
  go-ahead: removing files was refused by this session's permission check.
- GitHub: about 27 merged and 19 unmerged `claude/` branches are still on
  the remote, though `docs/audit/PHASE0_BASELINE.md` says the tidy deleted
  them. Deleting branches is the owner's call.
- Rare engine errors under heavy CPU load at 320x700 (audit finding F1,
  `PHASE0_BASELINE.md`): never pinned or fixed.
- Unmeasured: Career economy numbers (`docs/career/STATUS.md`).

## Parked by the owner (don't start unasked)

Career Phases 5/7/8 (smart event picks, resident relationships, boss
seats); "Ask P.I.P." question keys, P.I.P. memory and stages; opponents'
own speech bubbles (`claude/tender-dijkstra-zso8dm`).

## Next

Nothing scheduled. Ask the owner what they've noticed on their phone.
