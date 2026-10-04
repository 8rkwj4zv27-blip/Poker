# Settings + Workshop plan

The Settings sheet had grown to ~38 controls in one 7,190px scroll (about
eight and a half phone screens). Real settings (game speed, when the pot
pays out, Leave table) were mixed in with cosmetics (17 deal styles, smash
heat, 10 table-layout knobs). This plan splits it in two:

- **Settings (⚙)**: how the game *behaves*. Short, plain, about one and a
  half screens.
- **WORKSHOP**: how the machine *looks and sounds*. Drawers per part of
  the machine, live previews, and later the foundation for more decks,
  animations, dashboards and possibly a cosmetics shop.

Owner decisions (4 Oct 2026):
- The Workshop is called **WORKSHOP** and lives on the home screen, as a
  fun key in a different style from the other buttons.
- The table-layout knobs (Settings → The table) come out. The table keeps
  looking exactly as it does now.
- Table talk isn't a feature yet: its setting goes; the switched-off hook
  in `js/03-opponents.js` stays for the future pass.
- A volume slider: yes. High contrast: not now. Large text: not now (it
  would only grow the menus, never the console).
- Colour themes stay, and more of them come in the Workshop (Phase 4).

## Phases

1. **Clean Settings** (this one). Regroup ⚙, move every cosmetic into a
   plain Workshop page inside the sheet, add volume, four-colour deck and
   hand readout. Lab first: `settings-lab.html`.
2. **Workshop shell.** The home-screen WORKSHOP key (2–3 candidates in a
   lab), the drawers built from a cosmetics catalogue (one list of every
   cosmetic: name, preview, drawer), factory-setting keys.
3. **Previews**, one drawer at a time: a card thrown per deal style, TEST
   SMASH, coin sounds, card backs as real cards.
4. **New colour themes** in the Cabinet drawer.

## Phase 1: the new Settings

Top to bottom:

| Plate | Rows |
|---|---|
| THIS TABLE (only at a table, or when a saved table exists) | Save · Leave table · Reset run (danger) |
| PLAY | Game speed · Auto-continue · Award Pot (moved from Showdown: it changes the flow of play) · Confirm all-in |
| HELP | Hand readout (`strength`, new switch) · Win chance (`sdWinChance`) · P.I.P. report (`review`) · a line on the P.I.P. key |
| SOUND | Sound · Volume (`volume`, 0–10, new) |
| DISPLAY | Four-colour deck (`fourColour`, new switch) · Reduced motion |
| WORKSHOP key | opens the Workshop page |
| Service plate | Build · Developer Mode |

The Workshop page (Phase 1: inside the Settings sheet, plain): drawer
keys, each opening a page with the existing controls, unchanged:

| Drawer | Controls |
|---|---|
| CARDS | Card back · Card holder · Deck side |
| DEALING | Deal styles (the existing list) |
| SHOWDOWN | Smash · Force · Bounces · Heat · Into your bank |
| CHIPS & SOUND | Chip size (the one cosmetic kept from The table) · Coin sound |
| CABINET | Colour theme · Finishes |

Removed from the menu: the table-layout knobs (pot position, bet spots,
bet marks, machines; `settings.tableRoom` stays saved and applied), the
Machine plate (Finishes moves to Cabinet), the long P.I.P. paragraph.

**Saved settings:** every existing key keeps its name and value. New keys:
`volume` (default 10 = today's loudness). `tableTalk` is dropped from
`DEFAULT_SETTINGS`. Lifetime stats are untouched.

**Volume, in the game:** every synthesised sound goes straight to
`ctx.destination` today (about 15 places in the live files). It becomes one
master gain node (`Sound.out()`), and each of those connects to it. The lab
gets the same result with a small shim on `AudioContext.destination`.

## New parts for the Pattern Book (sign-off in the lab)

- **Setting row**: label and one-line hint on the left, control on the
  right (or below, for three options); rows inside a plate split by the
  seam rule instead of each row being its own box.
- **Drawer key**: a raised plate key that opens a page: lamp, title,
  current pick, chevron. Used for the Workshop entry and its drawers.
- **Volume control**: candidates FADER (a gold cap in a slot) and STEPS
  (ten rising bars, lit up to the level).
- **Layout**: ONE PANEL (one short scroll) or TABS (PLAY / HELP / SOUND /
  VIEW strip under the header).

## The lab

`settings-lab.html` + `js/settings-lab-host.js` + `js/settings-lab.js` +
`css/settings-lab.css`: the real game, full screen, with the new Settings
built from the real, wired controls (moved, not copied). TUNE (top left)
switches layout, volume control, hints, and BEFORE/AFTER, and jumps to
Settings at home or at a table.

- Round 1 link: https://claude.ai/artifact/LzMcL9V3kMTZ7GT1MTXW57 (4 Oct 2026)

**Round 1 verdict (owner, 4 Oct 2026):** "much better". Picks: ONE
PANEL, FADER, hints shown. The Workshop key comes out of Settings: the
Workshop lives only on the main menu.

**Round 2 (same link):** the Workshop as its own screen (Hand Rankings'
cabinet), opened from a home-screen key under the table buttons, in three
candidates for sign-off: DRAWER (a wooden drawer in the cabinet base with
a brass pull and a label card; slides out), HATCH (a screwed-on service
panel with hazard edges and a wrench; the screws spin and it swings open,
with the game's hatch sound) and KEYPLATE (a brass lock plate; the key
turns and the lamp lights). Finishes still opens in the Settings sheet in
the lab; in the game it moves into the Cabinet drawer. Note: the key makes
the home screen ~65px taller than an 852px phone, so it sits at the
bottom of a short scroll.

**Round 2 verdict (owner):** the three keys are too different; the
Workshop key is a button like Custom Game with a subtle trim. The inside
needs to work as a proper menu with every option and previews (Phase 3,
not built yet).

**Round 3 (same link):** the Workshop key is the Custom Game slab
(`pc-button-secondary`) with a gold line set inside its edge and a gold
stud either side of the word, under Quick Deal / Hand Rankings.

**Round 4 (same link):** the Workshop's inside. One menu (the same rows
and keys as Settings) under a preview window pinned at the top: a slice
of felt with the dealer's deck (the real deck code, borrowed: while the
Workshop is open the bench deck takes the `dealer-deck` id), your two
cards in their holder, a few chips (CoinWorld's own chip art at the
picked size) and a one-line CRT saying what's showing. Card backs deal a
card in the new back; each deal style has a play key that deals one card
that way; the deck side moves the deck; chip size redraws the chips; coin
sounds drop a chip with the sound; colour themes recolour everything.
The smash's preview needs a real pot: next round, at a table. TUNE:
button trim (GOLD LINE / STUDS / GOLD EDGE / LAMPS), where it sits,
ONE PANEL or CHOICE ROW, preview LARGE or SMALL, and COPY MY PICKS.

**Round 4 verdict (owner):** the one pinned preview doesn't work (the deal
previews showed nothing but a card leaving the deck). Each tab gets its
own preview; the rack (the Career event rack's feel) replaces the grids;
swiping previews and USE THIS chooses; a deal style's rarity is fixed to
its tier; Showdown goes from five rows to two (when it smashes + a smash
style); Finishes leaves Settings for a SCREENS tab.

Why round 4's deal preview showed nothing: `css/04-overlays-and-modes.css`
hides every `.fly-card` while `#table-screen` is hidden, so the flights
were running unseen. The Workshop needs an exception to that rule (the lab
has one) when it goes into the game.

**Round 5 (same link):** the Workshop as six tabs (CARDS, DEALING,
SHOWDOWN, CHIPS, CABINET, SCREENS). CARDS and DEALING are built: a stage
each (felt, the dealer's deck, your hand standing in the holder on a strip
of real dashboard; CARDS adds one big face-down card), the rack
(`js/workshop-rack.js`, a candidate part), USE THIS BACK / ADD TO THE MIX,
and the plain options under them. Browsing a back dresses the whole
Workshop in it and is put back on leaving unless you tap Use. Each deal
style deals both your cards when the rack lands on it (AGAIN replays).
SCREENS holds Finishes' list as it was. SHOWDOWN, CHIPS and CABINET keep
their plain controls until their rounds.

**Round 5 verdict (owner):** the floating card over your hand is wrong;
the backs must be flicked through as cards (no panels, no names) with
exactly the event cards' movement; the dealing preview is one card from
the deck on the left to the right, not your hand.

**Round 6 (same link):** `js/workshop-rack.js` is now the event rack's
own code (`js/career-hub-live.js`), ported number for number (geometry,
springs, grab lean and tilt, lift and drop shadow, the arriving card's
rise, throw, notches, end jolt), and its CSS is the live rack's
(`css/career-motion-live.css`). CARDS: the stage is the deck and your hand
in the holder; the rack is the card backs themselves, full size; the name
is on the CRT and the Use key. DEALING: the stage is felt only, the deck
at one side and a card's place at the other; landing on a style deals
one card across in it.

**Round 6 verdict (owner):** the backs in the rack don't look like the
deck's (patterns tiny) and shimmer while swiping; take the card holder
out of the Workshop; the CARDS stage is just the deck; DEALING's stage is
right; the style tickets are too wordy and don't show rarity.

**Round 7 (same link):** each back in the rack is the deck's own card
(`card back small`, 44x62) enlarged exactly x3 as one layer
(`will-change:transform`), so it is the deck's pattern and is rasterised
once instead of redrawn every frame. The name and Use key follow the
middle card as it moves (`onNotch`). CARDS' stage is the deck alone, at
twice its size. The holder row is out (kept wired, unseen); the deck's
side moved to DEALING, where it shows. Style tickets: coloured by rarity
(cream, green, blue, purple, gold), five pips, the name large, a banner
with the odds (Rare 1 in 50, Epic 1 in 80, Legendary 1 in 300) and a lamp
lit when it's in the mix; the description moved to the CRT.

**Round 7 verdict (owner):** CARDS doesn't need a preview (the rack is
one); fix clipped names (TRANSPORTER) so every text fits with room; then
build CHIPS, CABINET and SCREENS, with CRT screens and buttons split.

**Round 8 (same link):** seven tabs (BUTTONS split from SCREENS). CARDS:
the rack and a name screen only. Style names are sized to their longest
word. Every rack tab is one helper (`rackTab`: name screen, rack, Use key;
browsing shows, Use keeps, leaving puts back what's kept).
- CHIPS: felt with four stacks; the coin sounds are a rack of tickets
  (each with a big chip in the game's art); landing drops chips with that
  sound (played without keeping it); chip size under it redraws the
  stacks.
- CABINET: each theme is a little machine drawn in its own colours (the
  theme tokens apply to any element with `data-theme`); landing dresses
  the whole Workshop in it.
- SCREENS: each CRT look's card wears that look's own dials (the CRT
  tokens are attribute-scoped, so a card can carry its own; a low-weight
  reset of crt.css's level-0 values keeps the page's look out; in the
  game that reset belongs in crt.css).
- BUTTONS: three real keys (small, standard, big) to press; landing on a
  press feel puts it on the whole page for the moment.
- The name screens are `data-crt-quiet`: the channel-change effect merged
  quick changes and showed a stale name.

**Round 8 verdict (owner):** the card rack still showed duplicated and
changing backs; the rack works for CARDS but not for CHIPS, CABINET,
SCREENS or BUTTONS (keys may suit them better); the chip preview is poor
and chip size didn't change it; hold DEALING as it is. Rethink the four.

The card-rack bug: TABLE GREEN's look was only written for the Settings
grid (`#deck-back-seg .ds-swatch[data-cb="table"]`), so in the rack it
wore whatever back the page had: the back you'd just landed on. Fixed
with its own rule (weighted over `html[data-ds-on] .card.back`). The chip
size bug: moving the size row out of `#settings-table-room` cut it off
from table-room.js's painter, so its active key never moved.

**The card rack's real bug (round 9).** A back sets only some of its
`--cb-` values (frame, motif, motif edge, motif show are optional), and
every card in the rack inherited the rest from `<html>`, which wears the
back you last landed on: Sunburst's diamond came and went with it. Fixed
with a zero-weight reset of those four on each rack card
(`:where(#workshop .wr-back)`), so a back's own values win and the rest
fall back to the defaults, as on the table. Checked by reading every
card's motif under three page backs: identical (it wasn't before). The
same leak exists in the old Settings grid; it goes when that grid does.

**Round 8 verdict + plan (owner, 4 Oct 2026):** CHIPS, CABINET, SCREENS,
BUTTONS become choice keys that apply on a tap (no Use), each with a
preview of the real part.

**Round 9 (same link):**
- CHIPS: the stage's felt borrows the coin world's `#felt` while the tab
  is open (the table's is parked; walls rebuilt, the table's tray kept and
  put back), and every tap throws a real handful (`CoinWorld.throwAll`,
  'lob') into a pot zone (`ws:pot`) at the chosen size (`CW.OPT.size`) in
  the chosen sound (`CW.OPT.sfx`). The coin-sound keys' own three-coin
  preview is held back while the tab is open (the throw is the preview).
  Chip size keeps its own active key (cut off from table-room.js's
  painter when it moved).
- CABINET: four keys, each painted in its own theme (the key carries
  `data-theme`); a tap recolours the whole machine.
- SCREENS: the table's readouts (turn banner, hand readout, bet, stack)
  cycling real lines; six look keys via `Finishes.choose`.
- BUTTONS: real FOLD/CHECK/RAISE keys plus a small and a standard key;
  four press keys via `Finishes.choose`; choosing presses the console
  keys once so the feel shows at once.

**Held in place (owner, 4 Oct 2026):** the frame must never move. The
Workshop's cabinet was as tall as its content and centred, so a tab
change or a note wrapping to a second line moved both its edges.
- The cabinet now fills the phone (flex:1 0 auto in the screen): its
  edges, header and tab keys sit at the same place on every tab. Only a
  tab with more than fits grows past the screen and scrolls (the owner's
  one exception): DEALING on every phone, CHIPS on an SE.
- Every line whose text changes (the name and notes screens, the notes
  under the looks and presses, the Use notes, the SCREENS readouts) holds
  the height of the longest thing it can say, measured on the phone at
  its width when its tab opens (and on resize), rounded up from the exact
  height.
- Settings: the sheet is one height (88%) wherever it opens.
- Checked at 375x667, 393x852 and 430x932 by stepping every option on
  every tab: one layout per tab, the same cabinet edges across tabs.
- Hand Rankings and Custom Game have the same centring; left for later
  (owner).

**Round 10: SHOWDOWN (same link).** Two plates and a stage.
- WHEN IT SMASHES: the game's own four keys (Monster pots, Big pots,
  Every win, Off), moved in from Settings.
- SMASH STYLE: four presets, each setting force, bounces, heat and pickup
  together. Simmer is big, few, ember, flip. Big bang is the machine's own
  (huge, lots, ember, flip). Wild is max, endless, all-in, ripple. White
  hot is max, lots, white, all. A preset taps the original segs, which
  stay wired in the attic, so `settings.sdForce/sdBounce/sdHeat/sdPickup`
  save as before. A save that matches no preset shows as "Your own mix"
  until a style is picked.
- The stage is a felt that borrows `#felt`, just as CHIPS does. A pot of
  22 chips cooks in the chosen heat palette, shivering as it heats. Then
  it bangs (flash, jolt, the showdown's sound), bursts at the chosen
  force and bounces off the felt's walls. It settles and is picked up in
  the chosen way into a bank below the felt. It plays on opening the tab,
  on every style tap, and on SMASH AGAIN. With smash Off, the caption
  says the pot goes straight to the bank.
- The preview drives a copy of `showdown.js`'s burst (`explode`) and its
  heat palettes, using the live `Showdown.opt` values. It is not the
  sealed showdown sequence. When this is ported, `showdown.js` should
  expose a preview call so the copy can go.
- Fits the cabinet at 393x852 and 430x932 (felt 120px, notes kept to one
  line). It scrolls on an SE. One layout through every key.

**Round 10 verdict (owner):** the showdown felt is too small: the chips
hit the rails at once. Dealing stays as it is. Ship it all to the game.

**Shipped, v0.60.0.** The lab's code is now the game's:
- `js/settings-lab.js` became `js/workshop.js`, minus TUNE and the host.
  The picks it locked in are kept: one panel, the fader, hints shown, and
  the gold-line Workshop key under the row.
- `css/settings-lab.css` became `css/workshop.css`, minus the lab sheet
  and round 8's dead rack cards.
- The stage caption's two-line rule moved into `css/crt.css` (Pattern
  Book).
- `settings-lab.html` and its host are retired.
- SHOWDOWN's felt is 210px tall. The burst's speeds are scaled by the
  square root of its height against the table felt's (about 560px on a
  393x852 phone), so the chips cross the felt like they cross the table
  and land spread out, not on the rails. The tab now scrolls a little
  below a Pro Max (the owner's one exception).

**v0.60.1 fixes (owner, on the phone):**
- The home cabinet was cut off on a Pro Max: the Workshop key made it
  taller and `#home` didn't scroll. `fitHome()` in `js/workshop.js` now
  takes the overflow off the hero, down to its compact 292px. Any phone
  still too short scrolls the home screen.
- SHOWDOWN's key works like AWARD POT: hold it and the pot cooks (the
  game's steps, heat and shiver), let go and it bangs, as hard as it got
  hot. A tap gives the flare and a smaller bang. The chips fade out where
  they settle, with no invisible bank. The key is dimmed until a fresh
  pot is in the tray. Picking a style or a "when" only refreshes the pot.
- The coin layers are fixed to the screen, so while a felt is borrowed
  they now follow the Workshop's scroll. The chips no longer sit on the
  glass when the page moves.
