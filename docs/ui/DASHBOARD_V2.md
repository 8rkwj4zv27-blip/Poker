# Dashboard 2.0

The player's dashboard, rethought. Owner direction (25 September 2026): the
first pass (finish-only polish on the locked V1 layout) was too
restrictive. V2 may move things, add parts and add gameplay moments, as long
as it stays in the game's visual language. The machine should feel alive:
powering up, whirring, recessing, and, when you bust, breaking.

Status: **prototype lab, awaiting the owner's picks.** Nothing is live.

- Lab: `dashboard-v2-lab.html` + `js/dashboard-v2-lab.js` +
  `css/dashboard-v2-lab.css`. Isolated like every Lab; it reuses the real
  cards, chip art, faces, fonts, theme tokens, hand evaluation and `Sound`,
  and runs its own small hold'em driver (blinds, betting rounds, side pots,
  showdown, simple opponents) so every moment can be played. The engine is
  untouched.
- Built for a Mac: phone (iPhone 15 Pro Max, 430 × 932) in the middle,
  design switches on the left, moments and control experiments on the right.

## Owner answers that shape it

1. Size may change, within reason: options Compact (today) / Standard
   (+54px) / Tall (+110px).
2. Theatre is amplified, especially all-in.
3. New actions are experiments to try (lever, dial, throttle, knock,
   chip dragging, covered switch, hold-to-commit).
4. Coach instruments paused for now.
5. Card peek: yes.
6. All three new directions explored.

## Directions

- **V1+**: today's three bays, tidied and brought to life.
- **Console**: hand gauge, gears window, wide stack drum, raise dial,
  covered ALL-IN switch.
- **Slot**: marquee, paytable that lights your hand, payline window,
  CREDITS drum, pull lever to bet, coin-tray bank.
- **Cockpit**: annunciator tiles, raise throttle, twin gauges (hand, risk),
  covered ALL-IN switch.

## Moments and interactions in the lab

Keys rise on your turn and sink under a roll-top shutter while waiting;
power-up relays each hand; cards rise out of a tray; hold to peek;
double-tap the case to knock (check), refused with a buzz when facing a bet;
fold pulls the cards into the machine; drag chips from the bank to the felt;
all-in: beacons, siren, shake, stamped ALL IN, chip avalanche, stack drum
spins to zero, heartbeat run-out card by card; win payout with chase lamps
and the drum rolling up; bust: drum jams with sparks, screens go to static,
lamps pop, keys fall off, cracks and smoke, then REBUILD.

## Next

Owner tests the lab and picks a direction and interactions. Then: a design
plan for the chosen machine, new parts into the Pattern Book, and wiring
into the real game one part per release.
