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

## Round 1 picks (owner, 28 Sep 2026)

- Lip: **B · BRASS**
- Seat shadow (C): **ON**
- Width (D): **TODAY**
- Gap to the screen: **10px**
- Make room by: **HOLDER RISES**
- Card overhang: **TODAY**
- Table: burgundy

Round 1 notes: the cards flashed in the holder before they were dealt; a
thin white line showed as they turned; the seat shadow was too stepped.

## Round 2

- **The flash (a game bug, fixed in the game):** `syncCardRow()` builds new
  cards with `.deal-anim`, a fade-in (opacity 0 → 1). The deal then hides
  each card with inline `opacity:0` until its flight lands, but a running
  CSS animation beats an inline style, so the backs faded in in the seat
  for ~0.3s, vanished, then flew in. `revealHoleCardsAnimated()`,
  `dealCardFlight()` and the dealer deck's `dealCardFlight2()` now take
  `.deal-anim` off as they hide the card: its entrance is the flight.
  Frame log confirms the cards stay hidden until they land.
- **The white line (the lab's own bug):** the lab's card-shadow override
  also hit the invisible wrapper of a card mid-turn (`.card-turning`,
  which the game keeps at `box-shadow:none`) and the backs. It now only
  touches faces at rest.
- **Seat shadow:** a smooth, softer gradient (20% → 0 over 14px above the
  lip) in place of the two hard steps.
- The lab now opens on YOUR PICK.

Link republished (same URL).

## Live (v0.49.0)

The owner asked for a choice between the brass holder and the original,
both in the chosen position. Shipped as `css/card-holder.css` +
`js/card-holder.js`:

- Settings → The deck → **Card holder: Brass** (default) **/ Classic**
  (`settings.cardHolder`).
- Both: 10px of air above the hand-name screen (measured; the holder
  rises), today's width and overhang, the seat shadow.
- The cards' drop shadow is off on both while they sit in the holder
  (with the new air it peeked out under the classic lip too).
- The deal-flash fix (round 2) ships in the same release.
- Recorded in the Pattern Book (Card holder) and checked by
  `validation/pattern-book-checks.js`.
