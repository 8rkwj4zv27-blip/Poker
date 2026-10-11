# The Career desk: Career's main screen as a felt desk (plan + lab)

11 October 2026, with the owner. Lab: `career-hub-lab.html`, phone link
https://claude.ai/artifact/UdbYubPDiABddKThhANX4k (republish to the same link). Nothing here is in the game. It builds on the Pack
Opening V3 lab (`career/PACK_OPENING_V3_PLAN.md`) and the packs direction
(`career/PACKS_PLAN.md`), and supersedes the Hub Lab's ticket rack
(`hub-lab.html`) as the direction for the hub.

## What the hub is for (most used first)

1. Pick tonight's game and play it: two taps at most.
2. See where you are: bankroll and venues reached.
3. Buy packets (the shop).
4. Look through the album.
5. Leave, settings.

## Decided with the owner

- **Three suggested cards** on one brass lip, each tabbed with why it was
  dealt (NEW, NEXT STEP, BIG ONE, SAFE BET, A STRETCH; HOUSE when the case
  is thin: the house's own cards never run out).
- **Playing a card uses it up.** There is no archive of used cards: the
  **album** holds every design you've pulled, and inspecting one shows
  your history with it (played, best finish, won).
- **Matchbooks** show the venues you've reached; a first win in a venue
  sends the next venue's matchbook out of the slot.
- **The shop** is a mechanical Poker Faces machine shop: the packet table
  from the pack opening, with brass hatches the packets drop from.
- **Toys** (the owner asked for a few to try): the banker's lamp (pull the
  chain; in the dark the felt shows its secret), the brass bell (ring for
  the shop), the matchbooks (open; hold to strike a match), your chips
  (tap to riffle), and now and then a visitor looking in.

## The desk

- **The slot** (top): carry a card up to it and it bites the card under
  its brass plate; the CRT reads it; PAY (or tap the card) pays. Your chips
  slide into the slot, the card ratchets in, the cabinet shudders, a
  face-down IN PLAY marker holds its place while the hands count up, and
  the result comes back: your place on the marker, winnings as chips out
  of the slot, counted into the reel. (The lab simulates the table; the
  game would hand over to the existing ticket feed and Table Intro.)
- **Keys:** the dashboard's bay, CASE · PLAY · SHOP. PLAY puts tonight's
  best card in the slot; a second press pays. Every place is also an
  object on the desk (the case, the bell).
- **Moving between faces** (desk, shop, album) rolls everything on the
  felt away a tooth at a time with the drum's sounds; the game would use
  `MachineWheel`.

## Built in the lab

- `js/career-desk.js` + `css/career-desk.css` (CareerDesk), hosted by the
  pack scene (`js/pack-opening.js`), which owns the machine around it and
  hands it `CareerLab` (wallet, case, album, history, venues, doors).
- `career-hub-lab.html` (+ `js/career-hub-lab-boot.js`) opens on the desk;
  `pack-opening-lab.html` still opens at the packets.
- Checks: `validation/career-hub-checks.cjs` (touch harness).
- Polished in four review rounds against the owner's bar (tactile,
  satisfying, tidy, Poker Faces, phone-first).

## Open before it goes in the game

- The collection is a new saved key and a Career save migration.
- Chips from packs must stay below the pack's price (simulate first).
- New Pattern Book parts to sign off: the desk, the slot, the matchbooks,
  the lamp, the bell, the case, the shop's hatches, the inspect screen.
- The real handover to a table (ticket feed, Table Intro) and back.

## Round 2 (11 Oct): the owner's notes, and a simpler hub

The owner rejected the props desk: the lamp, the bell, the matchbooks, the
filing case, the chip taps and the hatch shop all go. The new direction:

- **The top cabinet:** the bankroll reel runs full width. Under it, the card
  slot sits in the middle, exactly a card wide and satisfying to feed. A
  CRT sits on each side, neat and symmetrical.
- **The felt:** a faint darker rectangle where three cards are thrown.
  They're chosen for reasons, but nothing on screen labels them. A deck
  in a corner deals one more card each time it's tapped. A key sucks
  them all up and deals three fresh.
- **The chips:** they work as in the game. Pick one up and throw it, it
  bounces, and a double tap tidies them. You can knock towers over. The
  pile follows the bankroll.
- **Moving between screens:** the shop rolls down from the top and the
  collection (later a collector's book with category pages) rolls up from
  below. The main hub is settled first.

**Stills first.** `hub-stills-lab.html` (`js/hub-stills.js`,
`css/hub-stills.css`) has four still layouts, A to D, switched with TUNE.
Nothing in them moves. It's published at
https://claude.ai/artifact/FpUrE7DTH5uqFqhV4eC8ir.

**Next:** once the owner picks a still, build its behaviour, then polish
it against their notes. `career-desk.js` is retired or cut down at that
point.

**Stills 2 (11 Oct).** The owner picked the plain slot (C). Their other notes:
- the two screens weren't aligned;
- the shuffle button looked rubbish;
- High Roller's towers were all over the felt.

Stills E to H use the plain slot in all four, and screens that share one
grid: same rows, centred, never wrapping. The two lines come three ways:
a label over a figure, a big figure over a label, or one line with a lamp.

There are three ways to deal again: a small machine lever by the deck, a
croupier's rake lying under the cards, or holding the deck.

The chips are one tidy row in the bottom-right corner, shaped as a
pyramid, a stair or a level row. The bankroll sets the number of towers
(1, 3, 5 or 7) and CoinWorld's change-making sets the chips' tiers.

TUNE mixes the parts and sets the bankroll. The link is the same.

**Still 3 (11 Oct).** The owner's notes on stills E to H:
- the cabinet's screens and slot were too tall;
- no rake or lever: tap the deck for a card, hold it to gather;
- the chips should be the game's bank (rows and columns with depth) in a
  corner;
- the cards were bunched.

`hub-stills-lab.html` is now one still:
- **The cabinet:** a slim row (the CRTs and slot are as tall as their
  content).
- **The deck:** alone in the bottom-left corner.
- **The chips:** in the bottom-right corner, laid out by the game's own
  `CoinWorld.rackSlots`. The count follows the table's bank curve and the
  colours come from `composeTiers`.
- **The cards:** spread across the felt. A fourth or fifth card reshuffles
  them into two rows.

TUNE sets the screens, the cards out (3, 4 or 5) and the bankroll.

**Moving version (11 Oct).** The owner's notes on still 3:
- the felt's spread moved with the size of the pile;
- the chips should pile like the table's (a pyramid building in the
  middle), not a neat staircase;
- build the moving version.

The stills became `career-main-lab.html` (`js/career-main.js`,
`css/career-main.css`), on the same link.
- **The spread:** fixed.
- **The chips:** CoinWorld's live chips, tidied by the pot's own shapes
  (`potSlots`: pyramid by default, heap or rows in TUNE).
- **The deck:** tap to deal (the hand shuffles up), hold to gather and
  deal three.
- **The cards:** drag to arrange, tap to inspect, drag into the slot to
  feed (it ratchets in).
- **PLAY:** pays the entry in chips through the slot, and the reel counts
  it off. Here the game would seat you.
- **SHOP and CARDS:** only say they'll roll down and up (next).

`career-desk.js` (the rejected props desk) is still used by the pack lab's
hub view. It's retired once this hub replaces that view.
