# Deal styles — how cards fly off the deck

> **Historical.** Deal styles shipped in v0.51.0 (28 September 2026). Kept as the record of how it was decided; the code and `docs/CODEMAP.md` describe the game today. Index of current docs: `docs/README.md`.

**Lab:** `deal-style-lab.html` · **Link:** https://claude.ai/artifact/NK7KfUt3U9ooe3gTQ62yqc

## The brief (owner, 28 Sep 2026)

The flick is nice, but 5–10 more ways a card can be dealt, with a preview
of each, a checklist of the ones I like, the option to have them random,
and how rare each is. One could be super rare and super fancy.

## Built into the game on this branch (not yet released)

- **Your cards turn in the air** (Holder Deal Lab, A): they turn over in
  the second half of the flight, arrive face up just above the holder's
  lip, and slip into the groove. `dealYours()` in `js/dealer-deck.js`.
- **Opponents' cards go under their cabinet:** the flight is clipped at
  the cabinet's bottom edge as it arrives, so the card slides under the
  profile card instead of landing on top and vanishing through it.
  `fly()` in `js/dealer-deck.js`.
- **A hook for styles:** `DealerDeck.flightFor(target)` may return
  `{ points, pace, decorate }`; unset, every card takes FLICK. Points gain
  an optional 9th value, yaw. `DealerDeck.preview(target, style)` flies
  one card for a preview without dealing.

## The styles (candidate: `js/deal-styles.js` + `css/deal-styles.css`)

| Style | Suggested rarity | What it does |
|---|---|---|
| FLICK | common | Today's deal. |
| SLIDE | common | Pushed low across the felt. |
| LOB | common | Tossed high, drops in with a little bounce. |
| WHIP | common | Fast and flat; snaps past its spot and settles back. |
| SWOOP | uncommon | Wide sideways curve (either side), banks in. |
| SKIP | uncommon | Skims the felt and skips twice. |
| SPIN | uncommon | A full flat turn in the air. |
| FLUTTER | uncommon | Floats up, rocks down like a leaf. |
| ROYAL FLOURISH | legendary | Rises in gold light, spins twice, hangs, dives in with sparks and a flash. |

Rarity weights: COMMON 10, UNCOMMON 4, RARE 1, LEGENDARY 0.15. The style
is rolled ONCE PER HAND (common/uncommon) or for EVERY CARD. Rare and
legendary styles only ever happen to a single card, as a surprise. Only
one style on = always that one.

## Round 2: a whole hand

The owner couldn't preview a full hand. Each style now has ▶ DEAL A WHOLE
HAND: a fresh hand dealt in just that style and played to the river
(everyone checks or calls; their thinking is cut short, the flights keep
their real speed), so every card flies: yours, theirs, the flop, turn
and river. ▶ FLY ONE is the old quick preview. DEAL (top left) plays a
whole hand from the mix. A bar at the bottom shows a forced style; tap it
to go back to the mix.

## Round 3: simpler

Round 2's whole-hand autoplay got stuck on the owner's phone and was more
than wanted. Now each style has one ▶ PLAY: a fresh hand dealt with every
card in that style, stopping at your turn. Another PLAY or DEAL always
just starts over. FLY ONE and the autoplay are gone.

## Round 4: the 2.5D card, five tiers

Owner: the card should feel 2.5D like the chips (a sprite, not a 3D
object): leaning, tipping and reacting to the air like a frisbee, never
pitching far enough to show its thickness, never over. The same on the
deck, the shuffle, the flop and the board turning. Specials bigger; the
railgun only a white-hot streak (no shields or crosses). Opponents' cards
still landed on top of their machines and faded under.

**The deck (`js/dealer-deck.js`)**
- Opponents' cards (`dealUnder`, live on the branch): the card lands just
  clear of the cabinet's bottom edge, no fade, then slides up under it.
  The round-3 clip-path cut-off is gone (not reliable on iPhone Safari).
- SPRITE mode (`order.sprite = 'on'`; unset in the game until signed
  off): the flying card's look moves onto a skin that holds a POSE
  stepped at 14 frames a second while the carrier glides: bank narrows
  it (up to 42%), pitch shortens it a little (up to 16%), spin snaps to
  15°, the light shifts; a pixel shadow on the felt drifts away as it
  rises. Your card's turn in the air becomes a squash-flip. Turns on the
  board and at the showdown (`turnCard2`) squash to a sliver and open
  back out; the shuffle and the flop spread lean in stepped frames.

**The styles (`js/deal-styles.js`), weights COMMON 10 · UNCOMMON 4 · RARE 1 · EPIC .4 · LEGENDARY .12**

| Tier | Styles |
|---|---|
| Common | Flick, Frisbee, Lob, Slide, Whip |
| Uncommon | Swoop, Skip, Spin, Flutter, Knuckleball |
| Rare | Boomerang, Shuriken, Magician, Glitch |
| Epic | Transporter, Comet |
| Legendary | Railgun, Royal Flourish |

Rare, epic and legendary only ever hit one card. Sounds for the specials
are made with Web Audio in the candidate (no files).

**The lab:** styles grouped by tier, each ▶ PLAY / on-off / rarity; THE
CARD (2.5D sprite / flat today) and SHADOW switches; slow motion.

## Round 5: stronger 2.5D, honest rarity

Owner: the 2.5D didn't read, and rare styles said "about 1 hand in 8".
- The pose is stronger: leans x1.35, bank narrows up to 50% and slants
  (skewY up to 9°), the side leaning away drops into shade in one hard
  step and a lit band shows on the side tipped to the lamp (the chips'
  trick), and the card grows as it rises.
- Rarity: COMMON/UNCOMMON share the hands by weight (10/4); RARE, EPIC
  and LEGENDARY are a fixed chance on any one card (1/500, 1/800, 1/3000):
  each rare style about 1 hand in 50, each epic 1 in 80, each legendary 1
  in 300 (any rare 1 in 13, any epic 1 in 40, any legendary 1 in 150 with
  all on). The lab shows the per-tier odds.

## Live (v0.51.0)

The owner: add them into the game, every style switchable by the player,
FLICK the default, the player sets the rarity; the rare/epic/legendary
levels as tested. Shipped: `js/deal-styles.js` + `css/deal-styles.css` in
the game, Settings → Dealing (FLICK ONLY / ALL ON, once per hand or every
card, a switch and a rarity per style; `settings.dealStyles`), the deck's
2.5D card on (`sprite:'on'`), your cards turning in the air and theirs
sliding under the cabinet. Recorded in the Pattern Book (Deal styles).

## Next

Unlocks (e.g. Career) are a separate decision, weighed against the
project's no-generic-unlock-systems principle.
