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
