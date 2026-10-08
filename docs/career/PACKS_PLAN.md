# Packs: Career as packs of event cards (plan)

Written 8 October 2026 with the owner. Status: **visual lab first**
(`pack-lab.html`). Nothing here is in the game, and no rule below is
decided until the owner has played the lab and says so.

## Why

The owner, on the Career Hub: "I can't tell where one location ends and
another begins", events don't read apart from Quick Deal, and characters
don't mean anything. After brainstorming venue maps, a lift, a route board,
a clockwork and a CRT scanner, the owner picked **packs of cards**: you buy
or earn sealed packs from a vending machine in the cabinet, rip them open
yourself, and the cards inside are your events, kept in a ticket case and
fed into the machine to play. (The Scanner is parked as the fallback idea.)

## The loop (what the lab shows)

1. **The vending machine.** One cabinet, six rows of packs on spiral coils,
   cheapest at the bottom, the gold Invitational at the top. Rows you
   haven't earned sit behind dark glass with an OUT OF ORDER card. Chips
   go in the slot, the coil turns, the pack catches, wobbles and drops.
2. **The pack in your hand.** Each tier has its own wrapper.
3. **The rip.** The tear follows your finger: a straight pull tears clean,
   a fast diagonal tears jagged, a slow drag peels. It changes the tear,
   never what's inside.
4. **The fan.** Flick through the cards. Rares make the machine hesitate,
   foils shimmer, a wild card glitches the screen, chips spill as coins.
5. **The ticket case.** Cards drop into a velvet case; duplicates stack
   (×2), empty slots show what's still out there.
6. **The feed.** A card goes into the machine and on into a real table
   (the existing ticket feed, buy-in and Table Intro).

## Decided with the owner (8 Oct 2026)

- Packs are **bought with bankroll chips and earned** by cashing or winning.
- **Never microtransactions.** No real money, ever, and no second currency.
- Progress is protected: winning a venue guarantees that venue's next key
  card; the Back Room staples (HOUSE cards) and the cash table never run
  out.
- Card kinds: event, new format, character table, big-money, challenge,
  **jinx** (a chosen trade-off, e.g. blinds double and payout doubles),
  **wild** (rare events that bend the table's rules), cosmetic, chips.
- Pricier packs treat the player: the Gold Invitational always holds the
  Invitational entry plus chips, a rare cosmetic and a strong wild chance.
- The look comes first: the lab sells the moments before any rules,
  catalogue or save work starts.

## Pack tiers in the lab (placeholder numbers)

| Pack | Price | Mostly | Treat |
|---|---|---|---|
| Back Alley | $25 | Back Room entries | a small chip tip |
| Pub | $75 | Pub entries, first formats | a challenge |
| Card Club | $250 | better events, formats | a jinx or cosmetic |
| Casino | $750 | character tables | chips, wild chance |
| High Roller | $2,500 | big events | a cosmetic, chips |
| Gold Invitational | $7,500 | the Invitational, guaranteed | chips, rare cosmetic, wild |

Prices sit at about a quarter of their venue's buy-in, so the card is the
invitation and the buy-in stays the real stake.

## Open questions (after the lab)

- **Chips in packs create money.** Each pack's average chip return must sit
  below its price, or packs become a money machine. Simulate before any
  build (`event-sim.js` style).
- Wild and jinx rules need engine work; variants that change hand ranking
  (deuces wild, lowball) touch the evaluator and come last, if at all.
- Challenge cards must be checkable by the engine, honestly.
- A card collection is a new saved key and a Career save migration.
- New per-venue characters and one-off visitors need the owner's art.
- The Pattern Book: the machine, the pack and the card frames are new
  parts; they get signed off from the lab and added to the book before
  they go in the game.

## The lab

`pack-lab.html` (+ `js/pack-lab-host.js`, `js/pack-lab-art.js`,
`js/pack-lab-sound.js`, `js/pack-lab.js`, `css/pack-lab.css`): the real
game, full screen, with Career replaced by the machine. A TUNE key opens a
sheet: pick a pack, force the pull (rare, foil, wild, jinx, chips), early
or late career, slow motion, sound. It runs on in-memory storage and never
touches a real save; the card fed in plays an existing Back Room event.

Link: https://claude.ai/artifact/45h2gSXxYLBFSN1LmaiHPz (republish to the same link after a change).
