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
