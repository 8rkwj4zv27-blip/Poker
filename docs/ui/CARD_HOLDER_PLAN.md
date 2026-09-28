# Card Holder — the lip your cards sit in

**Lab:** `card-holder-lab.html` · **Link:** https://claude.ai/artifact/3QcNsZc9kRuybCBrnPj9AX

## The brief (owner, 28 Sep 2026)

Keep the cards hanging over the dashboard edge, centred in it. Improve the
lip they sit in. Keep it simple: no contraptions. It shouldn't touch the
screen below it (PAIR OF KINGS).

## What's there today

Two pseudo-elements on `.seat.you` (`css/03-action-console.css`, with
per-size `top`/`width` overrides in `05-responsive-and-arcade.css`):
`::before` is the dark slot behind the cards, `::after` the front lip, a
flat 9px bar in the case colour with a faint checker, and no top edge,
face or underside. On a big iPhone (≥701px tall) the lip's bottom lands
exactly on the hand-name screen's top edge (0px of air), and it hides the
bottom 11px of the cards.

## The options in the lab

- **Lip:** A · MOULDED (lit top edge, flat face, dark underside, drop
  shadow) · B · BRASS (the instrument gold, a screw at each end) ·
  E · STEPPED (a shallow stepped front, wider at the foot) · TODAY.
- **Seat shadow (C):** the card feet darken in two hard steps above the
  lip, and the slot gets deeper.
- **Width (D):** today · snug (the cards + 10px) · wide (the centre bay + 4px).
- **Gap to the screen:** 0–12px of real air (measured on the phone).
- **Make room by:** the holder rises (screens stay put) or the screens drop.
- **Card overhang:** the cards alone ride higher or sink.
- **Looks:** MY PICK (A + C, 8px), BRASS + C, STEPPED + C, SNUG, WIDE TRAY, TODAY.

The new lips also drop the cards' own 3px drop shadow (the lip hides the
card feet anyway; it poked out under the shorter lips as dark blocks).

## Status

Round 1 sent. Waiting for the owner's picks (COPY MY PICKS in the TUNE tab).
