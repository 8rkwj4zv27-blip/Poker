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

Home-screen version: `pack-lab-app.html` (+ `pack-lab.webmanifest`). Once on
`main`, it lives at https://8rkwj4zv27-blip.github.io/Poker/pack-lab-app.html:
open it in Safari, Share, Add to Home Screen. It opens full screen like the
game, on in-memory storage (never the game's save), fresh each launch.

## Round 3 (8 Oct 2026): the Career hub, tickets dealt — superseded by Round 4

The owner on the Card Lab: the cards were hard to read, the art too
abstract and "very AI", and the hand awkward; picking cards up, the foil
and the shimmer were good. Decided:

- **Simple tickets that say what you're playing**, with a window kept
  for the owner's own artwork (until then: the faces at that table).
- **Variety by kind**: events are tickets, new formats are machine slips,
  character tables and wilds are playing cards, jinxes are dark slips.
- **The hub first**: bankroll and record, then tonight's tickets dealt
  from your collection, each tabbed with why it was dealt (next step,
  safe bet, new, overdue, wild, jinx), a slot and BUY IN, and two doors
  (the Case, the Vendor). **Two rows of three** is the favourite deal; the
  hand of five stays an option if it works without awkwardness (slide
  along the fan; pull a card out to carry it).
- Mockups as stills first, then the moving lab: `hub-lab.html`
  (+ `js/hub-lab-host.js`, `js/hub-lab.js`, `css/hub-lab.css`;
  home-screen: `hub-lab-app.html` + `hub-lab.webmanifest`).
- Link: https://claude.ai/artifact/2yG9jqdsRWqgXqCRitTqbM (home-screen, once
  on `main`: https://8rkwj4zv27-blip.github.io/Poker/hub-lab-app.html).
- Next: the Vendor and the Case screens to this standard.


## Round 4 (8 Oct 2026): three invitations and the top reader

Owner-authorised Hub polish, following review of the handover and Claude
conversation. The three-ticket composition supersedes Round 3's two rows of
three and tabbed reasons. This is a presentation lab, not a collecting/economy
implementation or a production promotion.

- One top machine head: back/settings keys, bankroll drums, shared CRT,
  quiet played/won/circuit record, and a ticket mouth at its lower edge.
- Three larger invitations on felt: an admission ticket, Harry's private
  playing-card invitation, and a Turbo machine slip. The existing portraits
  are temporary art windows for the owner's artwork, not final card art.
- Selection lifts one ticket forward and parks the other two behind it.
  A separate paper brief prints real field/stack/blind cadence/payout/roster
  terms. FACE ONLY in TUNE is a comparison, not the default.
- Short upward flick or FEED IT (with explicit entry cost), then alignment,
  five roller bites, the authoritative Career debit, bankroll roll and the
  real table. A deliberate drag into the mouth also works. Slow off-slot
  drags, diagonal gestures and cancelled touches return without paying.
- Risky entries retain the real confirmation dialog. Cancelling returns
  the ticket; insufficient bankroll disables entry. Returning with an active
  event displays ENTRY ALREADY PAID / CONTINUE EVENT and cannot charge again.
- No animated CSS filters. Paper uses controlled spring motion, hardware
  uses steps, and shadow lift uses a separate layer. Reduced Motion removes
  travel and kinetic flicks; FEED IT and direct slot placement remain usable.
- TUNE lives inside the game with 44px keys: PLAY / REST / SELECTED /
  AT THE SLOT, paper brief / face only, motion, speed and bankroll fixtures.
  `?pose=rest|selected|feed` renders the same layout as still studies;
  `?hub=1` opens the interactive Hub directly. Default launch starts Home.

Validation: before/after `npm test`; rendered 320×700, 375×667, 390×844 and
430×932; real emulated touch for paid key entry, fast flick, slow drag,
diagonal release and cancellation at the reader; risky cancel/confirm and
repeat entry; low bankroll; reduced motion; paid-event resume; native
storage sentinels for Career/settings. Review report:
`docs/career/HUB_ROUND4_REVIEW.md`.

Delivery: source is on `codex/hub-reader-polish`; the private Artifact bundle
is staged using the normal bundler. This session has no Claude Artifact
publisher, so the Round 3 link above still shows Round 3. Do not describe it
as updated. Review Round 4 through the local preview/screenshots until it
can be republished to that same link.

Next: owner reviews the card composition and feed feel on an actual phone.
Then decide any corrections before starting the Vendor. The Case, pack
prices, rarity, duplicates, collection saves and new event rules remain out
of this pass. The live Hub's small-iPhone BUY IN issue remains open.
