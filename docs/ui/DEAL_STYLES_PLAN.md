# Deal styles — how cards fly off the deck

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
| TUMBLE | uncommon | End over end. |
| BEAM | rare | Shrinks to a spark at the deck, streaks across, pops up. |
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

## Next

Owner's picks (COPY MY PICKS in the lab), then ship: the styles become a
setting (Settings → The deck), with the owner's mix as the default.
