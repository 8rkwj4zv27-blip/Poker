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
| The shoe | look (brass / velvet / marquee bulbs), size, where (left / right), its screen (cards left + words / cards left / off), the stack goes down, cut card, idle life |
| Card back | house crest / gold lattice / classic red / table green (today) |
| The shuffle | machine / riffle / none; every hand / new table only; short / long |
| Out of the shoe | kicked out / off the top; the shoe knocks; flight (flick / spin / slide); pace; felt puff; your cards turn as they land / both together |
| The board | burn cards; flop stack + spread / one by one; flop turns as they fan / all at once / one by one; turn + river straight in / lamp beat |
| The muck | into the shoe / onto the stack; all at once / round the table |
| Sound | mechanical / cards only |

## Rules the candidate keeps

- Presentation only. It wraps `dealCardFlight`, `dealCommunity`,
  `muckCards`, `playShuffle`, `keepPotClearOfDeck` and `clearAllCardDOM`,
  and hands back to the shipped functions for TODAY and Reduced Motion.
- The flop takes the same three cards off `g.deck` in the same order as
  the shipped `dealCommunity(3)`. Burn cards are drawn only; the engine's
  deck is never touched for them.
- The shoe is `#dealer-deck` itself, so the coin walls, the pot plate's
  clearance and the showdown's boxes all measure it.
- Its screen is a Pattern Book CRT (`.crt` + `.crt-figure` / `.crt-line`);
  only its layout is styled locally. The shoe is a new part: once the owner
  orders it, it goes into `docs/ui/PATTERN_BOOK.md` (and its check) before
  it ships.

## After the order

Ship the owner's picks into the game (a live `js/dealer-shoe.js` /
`css/dealer-shoe.css` with the picks fixed, the card back as the new
`cardBack` default, loaded by `index.html` and precached by `sw.js`), with
a validation suite, and bump `BUILD_VERSION` / `CACHE_NAME`.
