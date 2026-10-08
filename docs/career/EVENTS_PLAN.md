# Events rework — plan

Written 8 October 2026 with the owner. Status: **Release 1 live in
v0.67.0** (8 Oct 2026); next, the owner plays it, then Release 2. Measured with
`validation/tools/event-sim.js`; every number here can be re-run.

## Why

The owner, after long play: Career is "crushing" at the start. The first
tables should build your stack; playing for massive pots should be the
hard part. Today it runs the other way round:

- The Back Room has the **shallowest stacks and fastest blinds of the
  whole ladder** (25 big blinds, a level every 10 hands). The top has
  75 to 120 big blinds. The most luck sits exactly where the bankroll is
  built.
- Its events pay **only first place**, so the bankroll lurches.
- The first step up is steep: Pub Circuit costs $300 and its opponents
  jump straight from Medium to Hard.

The opponents are not the problem. A solid player beats Medium hand for
hand (`ai-sim.js`); it's the event format that turns that edge into a coin
toss.

## What the owner decided (8 Oct 2026)

- **Easier start, harder top.** Skill should count most at the start.
  Longer events are fine if skill counts.
- **Early events with more players that pay 2nd place.**
- **No overlay for now.** Prizes stay exactly what the entries add up to
  (the existing rule: no payout table creates or destroys money).
- **The heat gauge goes on the machine**, a meter on the ticket reader.
- **Venue ladders and new formats:** yes.
- **Later:** tickets that look different by tier (a small stub for a
  warm-up, something fancier for a headliner), and a real *moment* when you
  scroll to a fancier venue. Recorded here; designed after the ladders
  exist.

## How to read the numbers

`event-sim.js` plays whole events from the real catalogue. "You" are the
game's own AI at a skill on the 0–100 dial: **30** plays at the Back
Room's own level, **50** is a decent amateur, **80** a strong regular.
1,000 to 1,500 events each, seed 1. "$/event" is the average profit after
the entry.

## Today's Back Room 3-HAND (measured)

500 chips (25 big blinds), blinds up every 10 hands, Medium, $100 in,
$300 to the winner.

| You | Win | $/event | Hands |
|---|---|---|---|
| Same level (30) | 32% | −$3 | 22 |
| Decent (50) | 39% | +$17 | 22 |
| Strong (80) | 42% | +$26 | 22 |

- An even share of three seats is 33%: a strong player wins only 2 in 5.
- In 3 events out of 4 the two opponents clash first, and one of them
  comes out with about twice your chips. From there you win about a third
  of the time: that is chip arithmetic, not the AI picking on you. (When
  short, strong players move all in with a wide range rather than wait.
  P.I.P. could teach this at that moment.)

## Release 1 — the Back Room (live, v0.67.0)

One release, Back Room only. Opponent skill moves from Medium (30 on the
dial) to **20**. Stacks double and blinds slow down.

| Ticket | Players | Stack | Blinds up | Entry | Pays | Skill |
|---|---|---|---|---|---|---|
| **5-HAND** (new) | 5 | 1,000 (50 bb) | every 15 hands | $100 | $350 / $150 | 20 |
| **3-HAND** | 3 | 1,000 (50 bb) | every 15 hands | $100 | $300 | 20 |
| **HEADS-UP** | 2 | 1,200 (60 bb) | every 12 hands | $100 | $200 | 20 |
| **SECOND CHANCE** | as the 3-HAND | | | free | $150 | 20 |
| Cash table | unchanged | | | | | |

Measured:

| You | 3-HAND now → new, $/event | 3-HAND win | 5-HAND win | 5-HAND cash | 5-HAND $/event |
|---|---|---|---|---|---|
| Same level (30) | −$3 → +$2 | 34% | 23% | 45% | +$13 |
| Decent (50) | +$17 → **+$29** | 43% | 34% | **61%** | **+$59** |
| Strong (80) | +$26 → **+$46** | 49% | 36% | **66%** | **+$71** |

- The 3-HAND runs about 39 hands, the 5-HAND about 53 (today: 22). Real
  minutes per hand on the phone are still unmeasured; check them on the
  owner's phone before tuning further.
- The 5-HAND is the bankroll builder: you're paid in most events, and
  being better shows.
- Skill still decides: the same-level player only just breaks even.

HEADS-UP, today (600 chips, 30 bb, blinds every 8 hands, Medium) → new:

| You | Win | $/event | Hands |
|---|---|---|---|
| Same level (30) | 47% → 51% | −$5 → +$1 | 15 → 28 |
| Decent (50) | 54% → 59% | +$9 → **+$18** | 15 → 27 |
| Strong (80) | 59% → 63% | +$17 → **+$26** | 14 → 26 |

### How it's built (Release 1)

- A new optional **`skill`** (0–100) on an event. `startCareerEvent()` and
  resume set the table's skill from it (`aiSkillOf` already reads a
  table's skill before its named difficulty). An event without one plays
  its `difficulty` exactly as before.
- **Tickets already bought keep their terms.** A table in progress carries
  its event snapshot, so it finishes on the stack, blinds and opponents it
  was bought with. Only new tickets get the new terms. No save schema
  change.
- The 5-HAND is a new catalogue entry (`back-room-five`, Top-2, a
  freezeout like the rest), so a 1st place there unlocks the Pub like any
  Back Room win.
- Checks: `career-events-checks.js` for the catalogue and snapshots; the
  play-test; `event-sim.js` before and after, recorded here.
- A release: version, cache, changelog, handover.

## Release 2 — the heat gauge (lab first)

A needle meter on the ticket reader (the cabinet, not the ticket): when a
ticket slides into the reader, the needle swings to its heat with the
Machine Wheel's weight (wind-up, overshoot, settle) and a lamp lights per
zone. **Heat is one honest thing: how good the opponents are** (the
event's skill on the dial). Format stays in words on the ticket.

It's a new part, so it goes through a phone-first lab and the Pattern
Book before the game. Lab questions: where on the reader it sits, the
dial face and its words, how many zones and lamps, the swing, the sound.

## Release 3 — venue ladders

Each venue gets a small ladder of tickets:

- **Warm-up:** cheaper, more players, pays 2nd. The bankroll builder.
- **Main event:** the standard ticket.
- **Headliner:** bigger money, a deeper field, higher heat.

Any 1st place still unlocks the next venue (the existing rule). One venue
at a time, Pub first, each measured with `event-sim.js` before it ships.
Proposed opponent skill up the ladder (today in brackets):

| Back Room | Pub Circuit | Card Club | Casino Floor | High Roller | Invitational |
|---|---|---|---|---|---|
| 20 (30) | 35 (50) | 50 (50) | 65 (70) | 80 (90) | 90 (90) |

Headliners can sit a little above their venue's number; warm-ups a little
below.

## Release 4 — new formats

All real Hold'em; none changes the deck, betting or showdown.

- **Heads-Up Duel:** one opponent, one spotlight.
- **Bounty:** part of each entry is a bounty on that player's head, paid
  to whoever knocks them out. It rewards beating the big stack, and still
  creates no money.
- **Satellite:** win a **seat** in the next venue's event instead of cash.
  A seat is one entry to one event, not a currency (`CAREER_DESIGN.md`
  already approves satellites as a later feature).
- **Shootout:** win your table to reach a final table. The biggest build
  (more than one table); last.

## Later — the look (owner, 8 Oct)

- Tickets by tier: a small torn stub for a warm-up, the standard ticket for
  a main event, something fancier for a headliner (foil, a border, a
  stamp).
- Moving up a venue should be a moment: as the rack scrolls to a fancier
  venue, something about the machine changes (the light, the rack's
  material, a sound).

Both are labs once Release 3 gives the ladders their tiers.

## Rules this keeps

From `CAREER_DESIGN.md`: real no-limit Hold'em; no hidden help, no rigging,
no luck bonus; no payout creates money; only 1st place unlocks a venue;
Bankroll is the only currency; tickets already bought keep their terms.
