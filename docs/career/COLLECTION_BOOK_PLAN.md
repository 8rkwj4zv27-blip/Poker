# The card album (CARDS): plan

12 October 2026. Started from [`COLLECTION_BRIEF.md`](COLLECTION_BRIEF.md).
Lab: `collection-book-lab.html` (moving, round 2).
Owner's link: https://claude.ai/artifact/USQHuBYFeXwdJDVi8g7HEV
(re-stage with `validation/tools/lab-bundle.js` and republish to it).

## What the owner decided (12 Oct)

- **Think of it as an album of cards.** How cards are organised, split
  into categories, or whether one card has several rarities is **open**.
  Don't design the sorting yet.
- **A big leather-bound book.** CARDS brings it up from below the felt;
  it drops onto the table with a thunk, closed. Open the cover and there's
  the first page.
- **Four rows of four** on a page: a big collection visible from the start.
- **Three looks for a slot:** a card you have (bright); a card you found
  but used up (sits in the book, very dim); not found yet (an empty slot).
- **Tap a card and it lights up slightly; tap it again and you pull it out
  to inspect.** Inspect itself needs work and is looked at later; the
  card's history (played, best finish, won) waits for that.
- **Numbered tabs along the top** show where you are in the book.
- Turning pages: open (a tab, or flicking through with a swipe). The
  stills show the page dragged over by a finger, plus the tabs to jump.
- Pulling a card onto the felt takes it out of what the house deals:
  accepted ("okay"). Not in the stills.

## Round 1: stills (owner's notes, 12 Oct)

Five stills, on the felt or full screen. The owner: full screen "looks
shit", but on the felt was too small; the page turn went under the tabs;
the gold corners were too much; 4 × 4 too many; the book too noisy.

## Round 2: moving (built 12 Oct)

- **Size:** over the table and felt, from under INSERT CARD to above the
  keys; the reel, the feeder and the keys stay in view.
- **3 × 3**, the cards about the size of the tray's.
- **Calmer:** plain leather, one stitch line, a flat velvet page, quiet
  gilt edges, leather tabs with the number pressed in, a blind-pressed
  spade on the cover; the corners holding each card are leather.
- **Motion:** CARDS: up from behind the console, lifting, then dropped
  (thunk, the cabinet jolts, dust). Drag the cover open (or tap). Drag a
  page left: it follows the finger and lifts over the tabs; past halfway
  (or flicked) it falls over, else drops back; drag right to turn back.
  A tab: the pages riffle to it. Tap a card: it lifts and lights; again:
  out to the inspect screen (as it is), back into its place after. CARDS
  again: the cover shuts, the book lifts and sinks away. SHOP and the
  middle key are dark while it's out.
- **Option (TUNE): SLEEVES:** each card in a thin plastic sleeve; it slides
  out of the top before inspect and is tucked back in after.

## Round 2, fixes (owner's notes, 12 Oct)

The owner liked the book, the sleeves and inspect. Fixed: a turned page
stayed on screen (its `hidden` was overridden by `display:grid`), so the
next page turned underneath it and taps hit the old page's cards. Added:
a pull tab each side of the page (left: back a page, right: on a page),
dark at the first and last page.

## Open

- The owner's verdict on round 2: size, look, the drop, the turns,
  corners or sleeves.
- How the book is organised (see above); the inspect screen's rework and
  the card's history; then the save (owner's approval) and Pattern Book
  sign-off for the book as a new part.
