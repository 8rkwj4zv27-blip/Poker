# Pack Opening V3 — audit and plan ("The Squeeze")

11 October 2026. Approved by the owner the same day. **Slices 1 to 4 built**
(the packet; the reveal; the haul; a first polish pass: haptics, a
swinging price tag, packets that knock each other, foil flecks, a
flickable strip, a shake rattle, a prize count-up, a last-card heartbeat,
the hand read as a poker hand); then the shared inspect screen (owner, 11
Oct: a card is one specific table with its opponents; playing it uses it
up; an album records every design pulled; rarity = prize for now; twists
are placeholders; one inspect screen for pack, album and hub; then, on
their notes, no faces, the prize only on the card, two short lines, the
dashboard's keys, flick the card for the next, and inspect mid-opening),
plus the owner's notes: packets you can
move and throw, a drawn turn with a crimped edge and momentum, the foil
shimmer; the LEGENDARY stamp removed (the CRT flashes instead):
https://claude.ai/artifact/2A5hyH5pufRp7Tdj513SQp (republish to the same
link). Awaiting the owner's phone verdict. It replaces
the Pack Ritual lab's approach (`docs/career/PACK_RITUAL_HANDOVER.md`). That
lab stays on `codex/pack-ritual` as a reference, not as a base.

## 1. Audit: what we keep, what we throw away

**Keep (good, or approved):**
- The three foil packet designs (`js/pack-ritual-art.js`), as placeholder art.
- The 16 placeholder card faces (`js/pack-ritual-cards.js`). The owner will
  illustrate the final cards.
- The host pattern: the lab runs inside a copy of the real v0.67 game with
  memory-only saves, and it bundles to an Artifact phone link.
- The game parts: CoinWorld chips, CRT, press-feel keys, felt, bankroll reel.

**Throw away:**
- The controller (`js/pack-ritual.js`). It is button-driven, the easing is
  lerp rather than springs, it uses CSS-perspective 3D, and it is a dense
  single file that is hard to iterate on.
- The clip-path tear and the rigid packet.
- The pocket extraction, the 2×2 spread, the chip spill from nowhere and
  the BUY-button hop.

## 2. Diagnosis: why it doesn't feel good

1. **No concealment, so no anticipation.** The cards came out face up, so
   you saw each card before its "moment" played. Every great pack opener
   hides the result and lets *you* reveal it. This is the biggest fault.
2. **Buttons cause the moment, not your hand.** BUY / RIP / PULL / NEXT
   keys drove everything, with gestures bolted on. Physicality comes from
   your finger being the cause.
3. **It used the wrong motion language.** The game already has an approved
   language: the 2.5D sprite card (flat pixel card, poses stepped at
   14 fps, the SQUASH FLIP, hard-stepped shade, a pixel shadow that drifts
   as the card rises, a felt puff on landing, jolts), the Showdown house-lights
   DIP, THE COOK hold, COUNT IN and the dealer deck. The lab used smooth CSS
   perspective instead, so it looked foreign.
4. **No cause and effect.** Chips appeared from nowhere mid-reveal, the
   haul was dumped in a cramped grid, and there was no closing ritual.
5. **Nothing deforms.** The packet was a rigid box. The tear did not resist,
   release or recoil, and it threw nothing off.
6. **Rarity was bolted on after the reveal.** Rarity effects played after
   the card was already visible, instead of escalating the reveal itself.

## 3. What other games do (and what we take)

| Game | What works | What we take |
|---|---|---|
| Pokémon TCG Pocket | The finger slices across the pack top; the cut follows; the top flies off. One swipe per card. A results grid at the end. Very fast to repeat. | Finger-led cut; one gesture per card; speed. |
| Hearthstone | You *drag* the pack into a slot to open it (commit by gesture). Cards sit face down; hovering shows a rarity glow on the back *before* the flip; you choose the order; Legendary swells and bursts. | A rarity tell before the flip; player-chosen pace; escalation. |
| EA FC packs | The pack animation itself hints (flare colour) before the walkout reveal. | One pack-level tell: light leaking from the mouth. |
| Balatro | Juice everywhere: squash on touch, overshoot, a rising pitch per item, numbers that count, extreme speed. | A rising pitch across reveals; counting money; skip-anything speed. |
| Marvel Snap / MTG Arena | Inspected cards tilt with parallax and shine; rare pulls get their own flare. | The inspect "toy" feel. |
| **Baccarat squeeze / peeking hole cards** | The real casino ritual: bending a card's corner slowly to see its index. Maximum tension, pure poker. | **The signature mechanic.** Our cards already carry a C / UC / R / L corner index, so peeling the corner shows the rarity first, exactly like peeking at a card's rank. |

## 4. Plan A: "fix the list" (rejected)

Better tear, face-down cards, a bigger Legendary, hold-to-buy and a fan at
the end, all on the existing controller.

**Assessment:** it treats symptoms on the same architecture and motion
language, has no identity, and would land around 7/10 again. **Rejected.**

## 5. Plan B: "The Squeeze" (first draft)

A rebuild around concealment, the hand as the cause, and the game's own
motion language. Cards stay face down until you reveal them; you can
squeeze any card's corner.

**Assessment:**
- Seven gestures is too many to repeat hundreds of times.
- Squeezing every card is slow.
- A rarity tell on every card's back spoils the surprise.
- "Tip the pack to get chips" is a chore.
- The corner peel is a risk on iOS.
- There's no fast path for veterans.
- The ending and the Archive handoff were unspecified.

**Revise.**

## 6. Plan C: the plan (B, critiqued and fixed)

**The table.** At 390×844: bankroll reel and collection count up top, the
CRT status line (it does all the narration; there is no hint text on the
felt), then a big felt stage. At the bottom sits the game's **brass card-holder
lip**, which becomes your hand rail, with one primary machine key under it.
No new chrome.

### Beat 1: Packets are dealt in
The three packets are dealt onto the felt like the dealer's flick: slide,
land, felt puff, a stepped settle wobble.

Tap one: it slides forward and lifts (squash), and the other two slide back.
Drag to turn it over (its back, stepped at 14 fps) and catch the foil.

### Beat 2: Hold to buy (THE COOK language)
Press and hold the packet (or the key, labelled HOLD TO BUY):
- It lifts and trembles more and more, and the foil heats up.
- The price on its tag counts down while the bankroll reel counts down with
  it. You can see the money move.
- Let go early: it all springs back, so nothing is bought by accident.

At about 0.6 s it **pops**: a squash, a stretch, one stepped spin in the air
(the spin you asked for, as a consequence of the pop), then it lands in front
of you with a thud, a felt puff and a 2px jolt of the box. That replaces the
BUY button and its hop.

### Beat 3: The tear
The packet is drawn on a pixel canvas at the game's art scale, so it can
genuinely deform.
- Grab either end of the crimped seam and drag across.
- The packet leans toward your finger (resistance) and crinkles in stepped
  slices.
- The tear advances a pixel column at a time, with a grain of crackle sound
  every few columns, and the flap peels up on its hinge behind your finger.
- Stop and it holds. Pull fast and it rips in one go.
- At the end the flap snaps free, spins (stepped), bounces and lands. The
  packet springs open with a two-frame puff.

**The one tell:** if the pack holds a Legendary, warm light leaks from the
mouth. Otherwise there's no light, so the glow stays special.

### Beat 4: Draw the deck
The card backs are visible inside the mouth, using the game's own card-back
recipe and the player's chosen back.
- Drag up: the stack slides out with friction steps ("ka-ka-ka"). The front
  of the packet covers the stack because the canvas front, the DOM cards and
  the canvas back are layered in that order.
- It pops free and lands centre stage as a **squared deck**: the dealer
  deck's look, cards 2px apart showing trim.
- The empty wrapper slumps aside. Chips glint inside it.

### Beat 5: The reveal (the heart)
**Flick the top card:**
1. It slides off the deck (SLIDES OFF FIRST).
2. It **squash-flips** in the air.
3. It lands face up in the reveal spot.

The next flick sends the revealed card down into your hand rail and flips the
next. **One gesture per card.**

**Hold the top card instead and you squeeze it:**
- The corner peels up in stepped folds (2D transforms and clip-path, so iOS
  risk is low).
- The **C / UC / R / L** index shows first, then more of the face as you pull.
- Let go to snap it over. The squeeze is optional: drama when you want it,
  speed when you don't.

**Rare tell:** Rare and above give a single glint along the back's trim as it
slides off. It says "something's coming", not what. You can switch it off in
TUNE.

| Tier | The moment (each step adds to the one before) |
|---|---|
| Common (≈250 ms) | Squash flip, `Sound.cardLanded`, felt puff. Done. |
| Uncommon (≈350 ms) | + a rim gleam sweep; the landing note one step brighter. |
| Rare (≈600 ms) | + a hop (squash and stretch), the blue rim catching light, a foil shimmer, a two-note chime, pixel sparks, console lamps blinking once, and RARE on the CRT. |
| Legendary (≈1.2 s, skippable after 0.4 s) | The **house lights DIP** (Showdown's approved dip). Then a **hit-stop** at edge-on (a 60 ms freeze). The card comes round and slams toward you (stepped scale-up), with a white flash frame, rays in the event's colour (stepped 15°), a jolt of the box, and **coins already on the felt rattling** (the world reacts). A **LEGENDARY rubber stamp thunks onto the felt** beside it (`Sound.ticketPrint`). It then floats there in admire mode with its details sliding in. |

**Each event's Legendary gets its own flourish:**
- Bomb: the fuse spark crawls the edge, then an ember shower.
- Wild: three frames of colour misregistration and a palette swap.
- Freezeout: frost creeps in from the edges with a crackle.
- Table: a spotlight cone and a chip shower.

Every reveal's landing note steps up a semitone through the pack (the Balatro
trick), so a pack *builds*.

### Beat 6: Inspect (the toy)
Tap any revealed card. It lifts to centre, with name and rarity above and a
CRT details panel below (venue, prize, seats, special-rule synopsis).

It is drawn in the game's 2.5D language:
- Dragging banks it with a skew and hard-stepped shade.
- A pixel edge strip shows the stock's **thickness** on the side that's
  banking away.
- The foil band moves with the angle, stepped.

**Flick it and it spins with momentum** (squash-flip cycles through front and
back), slowing to rest. A fidget toy. Optional gyroscope tilt is a stretch
goal.

### Beat 7: The hand, the wrapper and the chips
Revealed cards collect on the brass rail as a **fanned poker hand**. After the
last card the fan lifts up into a held hand of cards (this replaces the 2×2
spread). Cards new to you carry a NEW pip, and you can tap any to inspect it.

The crumpled wrapper rattles. **Flick it away:** it tumbles off the felt
and the **chips spill out of it**, as real CoinWorld chips that bounce off the
cabinet like THE COOK. Cause and effect: you threw the packet, so its
contents fell out.

### Beat 8: Keep
Press KEEP:
1. The hand squares up with two taps, like the dealer deck.
2. The deck slides into the collection slot, top right, which bumps and
   counts up. (This is a placeholder until the Archive is designed.)
3. The chips pick themselves up into the bank, with COUNT IN on the reel.
4. The wrapper and strip are swept away.
5. Three fresh packets are dealt in.

### Tempo: fine the hundredth time
- **Any input fast-forwards the current animation.** Hearthstone works the
  same way.
- An expert opening takes **about 6–8 s**: tap, hold, swipe, swipe, four
  flicks, flick the wrapper, KEEP. Savouring is unlimited.
- One primary key always does "the next thing": HOLD TO BUY, OPEN, DRAW,
  REVEAL, KEEP. It covers one-handed play and accessibility. Gestures stay
  primary. Ghost-finger hints appear on the first run only.

### Built from the game, not invented
| Need | Existing part |
|---|---|
| Card flight, flip, shade, shadow | Deal Styles 2.5D sprite + SQUASH FLIP (`js/dealer-deck.js`) |
| Card backs, squared deck | Dealer deck backs + deck look |
| Hand rail | Card holder brass lip |
| Legendary dip | Showdown dip |
| Hold to buy | THE COOK hold |
| Shake, jolt, burst | `js/deal-styles.js` helpers |
| Chips, bounce, into bank | CoinWorld + COUNT IN |
| Sounds | `Sound.cardFlip/cardLanded/chipBounce/counterTick/ticketPrint/koThunk/stageLock`; only the tear and crinkle are new |
| Keys, CRT | press-feel, `.crt` roles |

New parts that need a Pattern Book entry after sign-off: the packet canvas,
the squeeze, the LEGENDARY stamp, and the hand fan as a collection view.

### Architecture
- **New lab, new controller.** `pack-opening-lab.html`, with the same host
  and bundler pattern.
- **Modules:**

  | File | Owns |
  |---|---|
  | `core` | Tick loop, springs, hit-stop, shake, the 14 fps pose stepper |
  | `packet-canvas` | Rasterised art, tear, flap, crinkle, mouth light |
  | `card-sprite` | The 2.5D rig, squeeze fold, thickness edge |
  | `reveal-fx` | Rarity moments and event flourishes |
  | `pack-opening` | Scene, state and input |

- **One pixel scale for canvas and DOM**, so nothing mismatches.
- **TUNE sheet (bottom sheet):** speeds, tells, squeeze, forced contents
  (all-common, each Legendary, double Legendary), sound and reduced motion.

### Delivery in four slices, each with your phone verdict
1. **The packet:** deal-in, pick, hold-to-buy, tear, draw the deck.
2. **The reveal:** flick, squash flip, squeeze, four tiers, Legendary and the
   four event flourishes.
3. **The haul:** hand fan, inspect toy, wrapper toss and chips, KEEP, restock,
   fast-forward.
4. **Polish:** a tuning pass from your notes, sound mix, small phones, reduced
   motion.

Each slice is published to the same Artifact link. I only move on when you
say it feels right. Evidence for each slice: 30 fps filmstrips of every beat,
touch-harness checks and `npm test`. I can't judge real-device feel; that's
why each slice comes to you.

### Bar for "done"
- An all-Common pack is still fun to open.
- You can say what rarity is coming before the card is fully over, with
  sound off.
- A Legendary makes you say something out loud.
- The tenth opening in a row takes under 10 s if you want it to.
- Nothing appears without a cause.
- Every part is either an existing game part or a new part you've signed off.

## 7. Plan C: final critical review
| Risk | Answer |
|---|---|
| Too many gestures | One rule: drag things where they want to go. One key does the next thing. Hints appear once. |
| Canvas and DOM look mismatched | One art pixel scale, and 14 fps stepping on both. |
| Corner squeeze on iOS | Flat 2D fold (clip-path and rotate), no `preserve-3d`. Fallback: plain squash flip. |
| Tells spoil the surprise | Only two: a Legendary glow at the mouth and a Rare+ trim glint. Both can be toggled in TUNE for you to judge. |
| People don't discover hold-to-buy | The key says HOLD TO BUY, and the tag pulses the price. |
| Legendary fatigue | It's rare, skippable after 0.4 s, and a double Legendary chains without repeating the dip. |
| Big-bang disappointment again | Four slices, each judged on your phone before the next. |
