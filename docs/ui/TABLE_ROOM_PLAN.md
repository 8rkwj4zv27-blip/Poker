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

## Next

The owner tries it on the phone and sends back their picks. The build
then follows from those picks.
