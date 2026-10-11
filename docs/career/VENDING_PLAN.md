# The packet machine: Career's shop as a vending machine (plan + lab)

11 October 2026, with the owner. Lab: `vending-lab.html`
(`js/vending-machine.js`, `css/vending-machine.css`), phone link
https://claude.ai/artifact/WKWLooBRqQNJGYqfbDf1B1 (republish to the same
link). Nothing here is in the game. Touch checks:
`validation/vending-checks.cjs`.

## How we got here

Rejected on 11 Oct, in order: the hatch shop with gold ticket plates (the
desk lab), a glass case and a hanging spinner rack that slid out from
under the cabinet (built, then thrown away: CSS furniture, thin gold
lines, packets shrunk, the felt covered), a printed felt layout and a
cashier's window (ideas only). The owner's own idea won: a vending
machine, after the Japanese cigarette machines (packs face-out behind
painted glass, a price tag and a push button under each, a chunky side
panel, red panelling).

## Decided with the owner

- **Where:** the machine takes the felt's place in the Career hub and rolls
  in and out on the wheel (`MachineWheel`). The cabinet (reel, CRTs, slot)
  and the console stay.
- **The window:** packets face-out under a fluorescent tube, a spare behind
  each, CARD PACKETS painted on the glass (TUNE turns it off). A black
  price tag and a chunky cream button with a lamp under each packet.
- **Choosing:** tap a packet or its button; tap again for another of the
  same (a flip counter by the button). The credit CRT shows the last one
  touched and the total. CLEAR (a button, never a lever) empties it.
- **Paying:** the console's middle key, held (HOLD TO BUY). Each chip
  leaves the reel as the game's 2.5D chip sprite, comes down to the slot
  face showing, turns up on its edge, pushes into the slit and goes in
  with a CHUNK. The credit counts up.
- **The lamps:** a rarity lamp each (C, UC, R, L), steady = always,
  blinking = maybe, off = never, with a legend. Five pips: cards for sure
  (every packet holds five things; the rest may be chips).
- **The drop:** the packet falls the whole way, down its column in the
  drop well (guide rails and a gate per column), into the tray behind a
  plastic PUSH flap, which knocks as it lands. The spare slides forward.
- **Stuck (now and then):** the packet hangs tipped on the price rail and
  the glass shimmers slightly. Tapping the machine frees it (two taps).
  No signs, no notes.
- **Taking them:** PUSH, the packets fan out in your hand; inspect one;
  flick it down to send it to the hub. Leaving takes the rest.
- **On the hub:** they wait in one pile, top right of the felt
  (WAITING 3), to be opened there with the pack opening.

## Round 2 (11 Oct): the owner's notes on the stills, and the moving lab

- No ALWAYS/MAYBE legend and no CARDS FOR SURE pips: leave things to be
  learnt, don't label everything. The four lamps stay (C, UC, R, L).
- More packets: 4 across (5 in TUNE), up to 4 rows; eight placeholder
  editions (new palettes in `js/pack-opening-packet.js`), a sold-out
  column. Short screens drop to 3 rows.
- Built like the Player Dashboard: the moulded frame, the checker case,
  sunk bays (the burgundy theme's materials). No velvet stripes; a speaker
  grille fills the side panel.
- The machine takes the cabinet's screen row and slot too (they're never
  used in the shop); the reel stays.
- The tray: one ribbed, smoked PUSH flap over the whole opening; packets
  fall past the rows below (no separate drop well), land, bounce and lie
  where they land, seen through the ribbed plastic.
- No fan: PUSH brings one packet out at a time; turn it, shake it, flick
  (or drag) it down to send it; the next comes out.
- Built and checked: the roll in (stepped teeth, overshoot, lock) and the
  boot (tube flicker, keys row by row); choosing with counts in the keys;
  CLEAR; hold to buy; the chips into the slot (face, turn, edge, push,
  CHUNK); the drop (relay, blink, motor, tip, tumble, the tray, the knock
  on the flap, the spare forward); stuck (the shimmer, two knocks); take,
  inspect, send; the roll out; the pile on the hub; opening one there
  (the pack opening, embedded) and KEEP into the deck.

## Round 3 (11 Oct): the owner's notes on the moving lab, and the hub

- Fixed: TUNE while the machine was down pushed it off the screen (it was
  measured from the hub's rows where the roll had pushed them). Fixed:
  every packet after the first opened with its cards half out.
- A packet's first tap only looks at it (its key glows, the CRT and lamps
  show it); the second (or its key) puts one in. The CRT: edition, price,
  TOTAL; long prices drop a size.
- The chips go in as a stream: one movement each from the reel to the
  slit, turning onto the edge on the way down; nothing waits on the CRT.
- The tray is seen straight on: packets lie on its bottom (or on each
  other), mostly on their sides, no squashed perspective.
- The hub: P.I.P. is gone; a printed card outline opposite the deck is the
  clean-up spot (tap: every card slides in, squares up, back into the
  deck, shuffled; holding the deck no longer sweeps). One table size:
  packets waiting, opened cards, the wrapper and the strip all match the
  hub's cards; the pile lands on a clear patch.
- After an opening the hand is read, then laid down among the cards. The
  wrapper (ripped seam) and the strip stay on the felt as things to push
  about or throw off the edge.
- The chips come out in a clear plastic bag with the amount on a sticker.
  Drag across its top corner to snip it; the chips spill and sit on the
  felt (tap one, it bounces) until the clean-up, which counts them (and
  any bag still shut) into the bankroll.

## Open

- The opening reveals four cards now; five things (cards or chips) need
  a fifth reveal and a chips reveal, and an economy simulation (chips
  below the price on average).
- The exact odds behind each lamp.
- Pattern Book sign-off for the new parts (the window, the keys and flip
  counters, the drop well, the flap, the side panel, the lamps).
- The editions, prices and lamp odds are placeholders.

## Next

The owner's notes on round 3 (the select tap, the chip stream, the flat
tray, the hub's clean-up spot, the bag), then polish from those notes.
