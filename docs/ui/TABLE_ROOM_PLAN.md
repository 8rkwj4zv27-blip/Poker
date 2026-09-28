# Table room: the crowded table (plan)

## The worry (owner, 28 Sep 2026)

With a big enemy bet, or all five shared cards out and the chips coming
in, the table feels crammed. The bets spill over the top of the board, and
the cards already sit on the opponents' bet squares.

Measured on the owner's phone (iPhone 15 Pro Max, installed app, 3
opponents): each opponent's bet square reaches **34px over the top of the
shared cards**. Between the bottom of a machine (tucked cards included) and
the board there is only about 60px, so a square spot can't fit there.

## The owner's plan (talked through before any build)

- **The pot moves down.** Same tray, same pile: the big pyramid stays.
- **Your bet spot gets wider and lower** instead of a square, so your bet
  sits in under the lower pot.
- **Bets form little piles** like the pot's, mostly upright but not rigid.
  Every coin stays visible.
- **Their tucked cards stay visible** under the machines.
- **The squares fade** (or become a smaller mark).
- **The machines get slightly smaller**, as an option to try. Faces and
  money must stay readable.

Nothing in the game changes until the owner picks settings in the lab.

## The lab

`table-room-lab.html` + `js/table-room-lab-host.js` + `js/table-room-lab.js`
+ `css/table-room-lab.css` (phone-first, see CLAUDE.md "Visual labs").

**Link:** https://claude.ai/artifact/XMVnkdiDJ2KNp2w6zZcWBb

- The real game at the phone's screen: 430 x 932, safe areas 59px / 34px,
  scaled to fit the viewer. Burgundy felt, chequered deck, a 3-opponent
  cash table with no hearts, lined up against the owner's screenshots.
- **Moments:** A BIG BET · ALL FIVE CARDS (your turn facing it), EVERYONE
  BETS · HELD BEFORE THE POT (every spot full on the river; POT IT sweeps),
  MONSTER POT · SHOWDOWN (all in, biggest pile, every hand shown), NEW HAND.
- **Controls (TUNE → THE TABLE):**
  - pot down 0–40px, and whether the room it gains means more air or a
    taller pile
  - your spot: square / wide / wider / widest
  - bets: spread (today) / little pile / loose pile
  - their spots: square / smaller square / wide / wide + low; height: today,
    8 or 16px up, or just above the cards
  - squares: how dark, square or corners only
  - machines: 100 / 96 / 93 / 90%
  - chips: 15px (today) / 14 / 13 / 12. One size for the whole coin world
    (table and bank), the same artwork drawn smaller; chips already down
    resize where they lie and the piles re-tidy. Added 28 Sep at the
    owner's ask: the chips looked big next to everything else.
- The meters show the gap between their squares and the board, the room
  for the pot pile, and the gap between your spot and the pot counter.
- **HOLD: TODAY** shows the game as it ships. COPY MY PICKS gives the
  settings as text.
- **Starting point** (the lab opens on this): pot 20px down with more air,
  your spot wider, little piles, their spots wide and just above the cards,
  squares fainter, machines 96%, chips 14px.

How it works: presentation only. It wraps `EnemyCards.spot`/`paint`
(squares and spots), `CoinWorld.zone` (it gives each bet spot a box and
the pot's pyramid/heap shape after `CoinTable.layout`), and, only while a
moment runs, `aiDecide` and `CoinTable.sweep`. The game's files are
unchanged.

## The owner's picks (28 Sep 2026)

`pot=30&potroom=grow&you=w130&pile=pile&their=w72&lift=16&fade=5&mark=corners&pods=90&coins=13`:
pot 30px down (taller pile), your spot widest, little piles, their spots
wide and 16px up, squares faintest as corners only, machines 90%, chips
13px. The lab now opens on these.

The owner's review of that round:
- **Your bet flew off towards the pot, and an all-in left chips on your
  spot.** The lab's little pile borrowed the bank's box, which is also a
  set of walls: landing chips bounced inside it for about 2.2s, longer
  than the 1.4s the sweep waits, so the sweep caught them mid-bounce.
  Fixed in the lab: the box only shapes the tidy (it exists only while
  the spot is neat), so a bet lands, bounces and spills as today and then
  gathers. It settles on today's timing. The same walls are the likely
  cause of the chips clipping.
- **The owner likes a few chips spilling out of the spot**, so the landing
  spill stays; LOOSE PILE also leaves a coin or two lying off the sides.
- **Chips spill off the bottom of the screen when the bank fills on a
  win**, in the lab and in the installed game. Not reproduced yet in
  emulated Chromium (a small win and a $3,600 showdown win, today's
  settings and the picks). Possibly Safari-only; waiting on the owner for
  when it happens.

## Shipped: v0.52.0 (28 Sep 2026)

The owner's picks are the game's default (`js/table-room.js`,
`css/table-room.css`), and Settings → The table offers every lab option
to the player, with ROOMY (the picks) and CLASSIC (the table before).

- The little piles are built into the coin world properly: a spot's
  `z.pile` footprint shapes the tidy (the pot's pyramid, small) and is
  never walls, so a bet lands, bounces and spills as before and settles
  on the old timing.
- Chip size: `SIZES` gained xs (12) and ms (14); the default is s (13).
  One size for the table and the bank.
- A short phone (max-height 700px, the SE) caps the pot's drop at 10px:
  at 30px it would sit on your bet spot. Measured on 375x667, 390x844
  and 430x932, ROOMY leaves more room than CLASSIC at every size.
- The lab starts the game on CLASSIC, so its HOLD: CLASSIC still shows
  the old table.

## Next

- **The player's bank:** chips spilling off the bottom of the screen on a
  win, on the owner's phone (lab and installed game). Not reproduced in
  emulated Chromium; a harder look on its own pass, likely Safari-only.
- **A tidier settings menu:** the options are building up; a separate
  pass.
