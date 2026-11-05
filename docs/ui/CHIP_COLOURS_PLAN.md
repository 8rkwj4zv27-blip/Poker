# Chip colours

Started 5 November 2026. Shipped in v0.71.4 (the owner's picks below).

## The ask

Bets, the pot and the bank show mostly white and red chips; the other
colours (green, black, purple, gold) almost never appear. The owner wants
colour variety like a real poker table, colours that climb as the stakes
rise, and no big drop in how many chips are thrown.

## Why it happens

A white chip is worth one small blind (`unit()`, `js/coin-table.js`), the
ladder goes up x5 (white, red, green, black, purple, gold), and a bet is
built from as many whites as its cap allows (`betCap` 16) before five of a
colour change up (`composeTiers`). So a bet stays all white up to 16 small
blinds; green needs about 1,000 at 10/20. Values follow the blinds, so a
3 BB raise looks the same at any stakes.

## The idea being tried

Make the white chip worth less (more chips per bet, so the change-up
brings the other colours in sooner, at about the same count), and
optionally give chips fixed values so bigger blinds bring richer colours.
New colours between the six (smaller steps than x5) are parked unless six
aren't enough: the x5 change-up runs through the pot, the bank and the
change-making.

## The lab

`chip-colours-lab.html` (+ `js/chip-colours-lab.js`,
`css/chip-colours-lab.css`; the host and sheet look are the Showdown
Lab's). The real game with a TUNE sheet: WHITE CHIP IS WORTH (10 today, 5,
2, 1 at 10/20), AS BLINDS RISE (follow / fixed), MOST CHIPS IN ONE BET,
BLINDS FROM THE NEXT HAND (stacks reset to 50 BB), a live chip key and
example bets. It sets `CoinWorld.OPT.white` (a hook in `unit()`; unset
means today's behaviour), `betCap` and `allinCap`.

Owner's link: https://claude.ai/artifact/U4Kb9QQErSKGFDX6rovsZS

## Decisions

5 Nov (owner, in the lab): white chip 2, values fixed, at most 16 chips
in a bet. Shipped in v0.71.4 as `CoinWorld.OPT.white = { fixed:2 }`
(`js/coin-table.js`). New colours between the six stay parked.
