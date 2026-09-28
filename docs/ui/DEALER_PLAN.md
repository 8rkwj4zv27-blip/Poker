# The dealer shoe

The dealer's deck pass (27 September 2026). The owner's brief: make the deck
stand out, feel polished and part of the machine. Direction chosen in chat:
**a dealing shoe** plus every small detail, with more flourishes, all
testable in a Lab. No hands, no flicker arm, no dealer face (that could be a
later pass).

## What the deck did before

- A loose pile of ten card backs at the bottom left of the felt, in the
  table-green back, so it disappeared into the felt.
- It never changed: no count, no shrinking, no reaction.
- No shuffle (`playShuffle()` was a stub), no burn cards.
- Cards flew from the pile (Dealer Flick) and swept back to it (House Sweep).

## Round 1 → round 2

Round 1 (a shoe drawn from the front: a box with a screen and a card
poking out of the top) was turned down: "it looks like a toaster... I have
no idea what it's supposed to be." Everything else (the flop spread, burns,
shuffle, muck, card back, feel) was liked. The fault was the view: the
table is drawn from above and the shoe from the front, and at 60px a real
shoe's wedge and thumb notch don't read.

Round 2 draws the deck from above like the rest of the table: the top card
shows its back, the cards under it show as cream edges, and the top card
sinks as the deck runs down. Three holders to inspect: the dealer's tray
(my suggestion), the deck alone, and a shoe redrawn from above. The
counter is a small brass plaque with a CRT, under the holder, beside it,
or off. The riffle is now the suggested shuffle; the old machine shuffle is
RATTLE.

## Round 2 → round 3

Round 2: the animations stay as they are ("the animations are great"), but
the tray, the shoe and the card counter go ("I hate the dealer machine and
the card count"). The deck itself looked off: the red cut card read as a
mistake, and the cream edges at an angle didn't match the back on top.

Round 3 is just the deck. The cards under the top one show as a stepped
edge straight down, in the back's own colours (burgundy and gold for the
house backs), thinner as the deck runs down. New: the player can press on
the deck and drag it anywhere on the felt; it stays there (the Lab keeps it
across re-deals, the game would keep it on the device), the burn pile moves
to the side facing the table, and the pot plate and the coins' walls
re-measure around it.

## Round 3 → round 4

Round 3: the owner still wasn't sure of the deck; the burn pile went off
the table; the deck's top card was styled on its own and lost the gold
trim the flying cards keep, so the deck and the cards off it didn't match;
moving it by finger wasn't needed, left or right is enough. The ask: "a
really nice, simple but superbly animated deck being shuffled and dealt
out", and ten card backs to choose from.

Round 4: the deck is made of the same card as the ones dealt off it (one
card-back recipe for every face-down card), with a few more of the same
card showing two pixels apart underneath, thinner as it runs down. It sits
bottom left or bottom right. The shuffle is by hand: split, riffle, the
bridge, squared up with two taps (FULL + CUT adds a cut; QUICK is split,
riffle, square). Burns slide off and tuck under the deck. The muck comes
back onto the top of the deck, which thickens as the cards land, then is
squared up. Ten backs: house crest, gold lattice, classic red, velvet
stripe, midnight, emerald crest, casino check, sunburst, ivory, harlequin
(and TABLE GREEN, today's, to compare). In the game the back and the side
would be player settings.

## The Lab: `deck-lab.html`

The owner's link (a private Artifact; republish to the same link):
https://claude.ai/artifact/KwFjkbtfyjbztn7dfk3Ruj

Phone-first, like the Showdown Lab: the real game full screen, a TUNE key
and a bottom sheet (`js/deck-lab.js`), on the Showdown Lab's host
(`js/showdown-lab-host.js`) and sheet styles (`css/showdown-lab.css`). The
candidate is `js/dealer-shoe.js` + `css/dealer-shoe.css` (`DealerShoe.apply`,
options as `data-ds-*` on `<html>`). THE DEALER: NEW SHOE / TODAY switches
between the candidate and the shipped deck.

Keys on the table: TUNE (the sheet), NEXT HAND (play the hand out, muck,
shuffle, deal the next), AUTO (keep dealing hands).

| Group | Rows (first option = suggestion) |
|---|---|
| Card back | ten backs, shown as cards in a picker, plus table green (today) |
| The deck | side (bottom left / bottom right), size (standard / big) |
| The shuffle | full / full + cut / quick riffle / none; every hand / new table only; burn cards tuck under / off |
| Off the deck | slides off first / flies straight; the deck knocks; flight (flick / spin / slide); pace; felt puff; your cards turn as they land / both together |
| The board | flop stack + spread / one by one; flop turns as they fan / all at once / one by one; turn + river straight in / three taps |
| The muck | back onto the deck, then squared up; all at once / round the table |
| Sound | mechanical / cards only |

## Rules the candidate keeps

- Presentation only. It wraps `dealCardFlight`, `dealCommunity`,
  `muckCards`, `playShuffle`, `keepPotClearOfDeck` and `clearAllCardDOM`,
  and hands back to the shipped functions for TODAY and Reduced Motion.
- The flop takes the same three cards off `g.deck` in the same order as
  the shipped `dealCommunity(3)`. Burn cards are drawn only; the engine's
  deck is never touched for them.
- The holder is `#dealer-deck` itself, so the coin walls, the pot plate's
  clearance and the showdown's boxes all measure it.
- The deck's look is a new part: once the owner
  orders it, it goes into `docs/ui/PATTERN_BOOK.md` (and its check) before
  it ships.

## Shipped (v0.45.0)

The owner's round-4 order is live: `js/dealer-deck.js` + `css/dealer-deck.css`
(the Lab's candidate, renamed, with the order as its defaults), loaded by
`index.html` after `js/showdown.js` and precached by `sw.js`. The order:
house crest, bottom left, standard size, full shuffle every hand, burns
tucked under, slides off first, the deck knocks, the Dealer Flick, today's
pace, felt puff, your cards turn as they land, stack + spread, turns as it
fans, three taps before the turn and river, the muck all at once,
mechanical sounds. Settings → The deck gives the player the card back (ten
backs, plus the old table green) and the side (`settings.deckBack`,
`settings.deckSide`). Recorded in `docs/ui/PATTERN_BOOK.md` (Dealer deck);
checked by `validation/dealer-deck-checks.js`. The Deck Lab now runs on the
live file and only adds its controls.
