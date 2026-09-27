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

## The Lab: `deck-lab.html`

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
| The deck | what holds it (dealer's tray / just the deck / shoe from above), finish (brass / velvet / black + gold), size, where (left / right), the stack goes down, cut card |
| Cards left | where it sits (under the deck / beside it / off), count + words / count only, idle life |
| Card back | house crest / gold lattice / classic red / table green (today) |
| The shuffle | riffle / rattle / none; every hand / new table only; short / long |
| Off the deck | slides off first / flies straight; the deck knocks; flight (flick / spin / slide); pace; felt puff; your cards turn as they land / both together |
| The board | burn cards; flop stack + spread / one by one; flop turns as they fan / all at once / one by one; turn + river straight in / lamp beat |
| The muck | onto the deck / tucked in; all at once / round the table |
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
- The counter's screen is a Pattern Book CRT (`.crt` + `.crt-figure` /
  `.crt-line`); only its layout is styled locally. The holder is a new part: once the owner
  orders it, it goes into `docs/ui/PATTERN_BOOK.md` (and its check) before
  it ships.

## After the order

Ship the owner's picks into the game (a live `js/dealer-shoe.js` /
`css/dealer-shoe.css` with the picks fixed, the card back as the new
`cardBack` default, loaded by `index.html` and precached by `sw.js`), with
a validation suite, and bump `BUILD_VERSION` / `CACHE_NAME`.
