# Felt plan: the table's rail, cloth and markings

**Lab:** `felt-lab.html` (+ `js/felt-lab-host.js`, `js/felt-lab.js`,
`css/felt-lab.css`). **Owner's link:** https://claude.ai/artifact/DKBPiQKX8swM15Cufx7Yew
(republish to the same link after changes).

## Why

The table today (`css/02-screens.css`, `.felt` and its `::before`/`::after`)
is a two-tone checker cloth, a 12px wood rail that mostly sits off the
screen edges, a 10%-white dashed betting line and a hard-edged lighter oval.
It reads as green, but not much as a table: the rail barely shows, the
stitching is nearly invisible, the oval's edge cuts across the lower felt,
and nothing is printed on the cloth.

## What the lab offers (first option in each row is today's table)

- **Rail:** as now, chunky oak (theme wood), walnut with brass studs, padded
  burgundy leather, velvet with gold piping, mahogany with a gold inlay,
  black leather with gold piping, riveted arcade chrome, marquee bulbs that
  chase. Width: as designed / slim 14 / medium 20 / chunky 26. Every rail
  but AS NOW shows the whole rim, so the felt sits in by the rail's width.
- **Stitching:** as now, none, running, long, pick dots, double, braid,
  cross-stitch, pressed seam. Thread: gold, cream, theme accent, tone on
  tone, dark. Runs on the betting line, by the rail, or both.
- **Cloth:** as now (8px checker), fine check, big check, tweed, velvet nap,
  diamond weave, flat. **Felt colour:** as theme, casino green, deep green,
  blue baize, red velvet, petrol teal, plum, charcoal.
- **Light:** as now, none, stepped lamp pool, soft lamp, dark corners, lamp +
  corners, billiard lamp, smoky room. Lamps centre on the board.
- **Markings:** card slots / stitched box / printed frame round the board;
  a THE TABLE wordmark (under the board), NO LIMIT · TEXAS HOLD'EM arc
  lettering (under the pot), suit pips. Bet spots: as now, stitched, rings,
  gold box, pressed, hidden. Felt meets console: as now, shadow, brass bar,
  deep lip.
- **Looks:** AS NOW, CASINO CLASSIC, VELVET MACHINE, BRASS PARLOUR, MARQUEE,
  BACKROOM, ARCADE, HIGH ROLLER, RED ROOM, BLUE BAIZE.
- **Scenes:** the deal, flop, river, showdown, heads-up, full table (6),
  empty table. **Theme:** emerald, burgundy, midnight, slate.

COPY MY PICKS (SCENE tab) gives the owner's choice as text.

## Owner's answers (28 Sep 2026)

"Didn't love a lot of the design choices. Really loud and noisy... I really
don't want anything visually messy or noisy or loud." What worked is plain:

- Rail: as it was. Stitching: long stitch, dark thread, by the rail.
- Cloth: fine check. Felt colour: as theme. Light: soft lamp.
- No board marking, nothing printed on the felt, bet spots and the
  felt/console seam as they were.

Direction for any later table work: quiet, plain, tone-on-tone. No loud
materials, lettering or ornament on the table.

## In the game: v0.47.0 · Felt

`css/02-screens.css` `.felt`: the soft lamp (centred on the board at 57%)
over a 4px check, and `.felt::after` is the stitch, an SVG stroke
(`rgba(0,0,0,.42)`, dash 11/5) centred on a box 5px inside the felt so only
its inner 2px shows. Landscape keeps its own corner radius
(`css/05-responsive-and-arcade.css`).

The lab keeps every other option, and BEFORE V0.47 (a look, and a choice in
the stitching, cloth and light rows) shows the old table. They are there
for a later customisation feature (for example a shop of table finishes);
none of it loads in the game.
