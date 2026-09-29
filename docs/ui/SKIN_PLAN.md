# Your own art: the skin plan

The owner draws pixel art and wants to replace the game's art with their
own, drawing over the existing designs at the same sizes (29 Sep 2026).
This is the plan for doing that without breaking or reshaping the game,
starting with a pilot on the cards.

**Lab link (the owner's phone):** https://claude.ai/artifact/SxaSDfgn69uMGp1sFv8pDW
(`skin-lab.html`, round 1: the card pilot).

## What the game's art actually is

Checked in the code, not assumed:

| Kind | What | Replaceable how |
|---|---|---|
| Image files | Opponent faces (`assets/faces/*.PNG`, 512×512) | Same file names, drawn over; no code change |
| Dead image files | `assets/chips/*.png`: the old high-res chips. Since v0.46.0 the chips are pixel sprites drawn by `js/coin-world.js` (`art:'gold'`); these PNGs are only a fallback path the game never takes | Not worth drawing |
| Styled boxes (most of it) | Cards, backs, dashboard, keys, CRT screens, meters, panels, felt | Nothing to extract: rendered out to templates, then laid back over the same element |
| Code-drawn sprites | Coins in the pot, the Coach's set, knockout and deal effects | Need a fixed frame set agreed first (e.g. a coin spin in N frames) |

So "extract the art" means **render each part out of the running game into
a template**, and "put it back" means **lay the drawing over the same
element**. The element keeps its size, classes, animation and behaviour,
so poker logic and layout can't be touched by it.

## The pilot: cards

Cards first because they're the most seen, they never stretch (every card
in the game has the same ~0.7 shape, so no 9-slice), and they exercise the
whole loop: export, draw, load, see it on the table, hand in.

### Sizes (tiers)

Measured in the game on an iPhone-sized table (390×844). A card is laid
out at one of these and drawn from the nearest tier:

| Tier | Size | Where | Notes |
|---|---|---|---|
| L | 62×88 | your two cards in the holder | 46×65 on short phones (scaled) |
| M | 44×62 | the board, the deck, the flights | |
| S | 32×46 | opponents' cards | the table shrinks them to about 25×36 at rest and grows them ×1.38 at a showdown, so art drawn at 32×46 shows at roughly 1:1 when their faces are seen |

Everything else (Settings swatches, the result screens' little cards, the
hand chart) uses the nearest tier, scaled.

### Parts

Per tier, three drawings (templates in `assets/skin/templates/cards/`):

- **back** — the whole back.
- **face** — a blank face: edge, paper, highlight; no rank or suit.
- **index sheet** — row 1 the ranks A–K in black, row 2 in red, row 3 the
  four small suits (♠ ♥ ♦ ♣), row 4 the four big pips. `cards.json` says
  where every cell lands on a card; rank and small suit move with the rank
  (a 10 is two characters wide), as they do in the game today.
- plus `cards-?-index-guide.png`: the sheet with every cell shaded, a guide
  layer to draw over. Nothing outside a cell reaches a card.

The game builds each face from these: blank, then rank, small suit, big
pip. 3 drawings per tier (9 in all) instead of 52 cards per tier.

### Rules for drawing

- Same size as the template, or exactly 2× or 3× it (finer pixels). Any
  other size is stretched to fit and the lab says so.
- Keep transparent pixels transparent (outside the rounded corners, and
  everywhere on the index sheet outside the glyphs).
- A part not drawn for a tier comes from another tier the owner has drawn
  (scaled), then from the template, which is the game's own look. A
  half-finished set never shows a hole.

### How it's built

- `validation/tools/skin-cards-export.js` renders the templates from the
  real game: every stylesheet, the default settings, and each card inside a
  copy of its real context (your holder, the board, an opponent's seat, the
  deck), captured part by part at one pixel per CSS pixel. Soft edges are
  made hard (alpha 50%), so every template pixel is a whole pixel. It then
  **proves the cut**: all 156 cards are rebuilt from the parts and
  compared with the game's real card. It fails if any pixel away from a
  glyph's soft edge differs, or if any part's centre of ink drifts more
  than 0.8px (measured baseline about 0.65px; a 1px slip gives 1.1px or
  more, and `SKIN_NUDGE=1` checks that it does fail).
- `js/card-skin.js` + `css/card-skin.css` (the candidate): composes each
  face, then lays the picture over every `.card` as its `::after`. Outer
  glows, win rings, the showdown's dimming and the holder's shade keep
  working over the art. Each card is dressed the moment it appears (a
  MutationObserver). It is **not loaded by the game**; the lab injects it.
- Left as the game's own, on purpose: the cards under the deck's top card
  (they only show a line of trim and ink each, so the deck still reads as
  a stack; each is dressed when it reaches the top), and the back swatches
  in Settings → The deck.
- The suits in the game today aren't in the pixel fonts: they fall back to
  the phone's system font, so they differ slightly between phones. Drawn
  suits fix that.

### The lab (`skin-lab.html`)

Phone-first, the real game full screen, a SKIN key on the felt's left edge:

- **TEMPLATES** — save any template, or all of them in one .zip (with a
  READ ME). Saving uses the Artifact `downloads` capability.
- **YOUR ART** — nine slots (3 tiers × back / blank face / index sheet).
  LOAD picks a picture from the phone; the table's cards wear it at once,
  and the slot says whether its size is right. SHOW flips between YOUR ART,
  TEMPLATES (must look exactly like the game: that's the check), DEMO (the
  templates recoloured, to see a swap at once) and GAME'S OWN. Drawings
  stay in that browser until cleared.
- **HAND IN TO CLAUDE** — uploads each loaded drawing, pixel for pixel, to
  the lab's asset store (`assets` capability) with a `db` row per slot
  (`handin/<slot>`: asset id, size, time). A later session reads them with
  `ArtifactData list handin` and fetches each with `Artifact read path=<asset id>`.
- **LOOK** — deal a new hand, run to the river, a showdown with everyone's
  cards up, and the whole deck spread out.

Checked with real touch in an emulated iPhone:
`validation/tools/skin-lab-scenario.js` (templates vs the game's own,
loading drawings through the file picker, a 2× drawing, every card
dressed at a showdown, the spread deck, clearing, no missing files, no
page errors). It passes against the local lab and against the staged
bundle.

## Next, once the owner has drawn cards

1. The owner hands in (or uploads to `assets/skin/cards/` on GitHub, same
   file names as the templates).
2. Ship: load `card-skin.js`/`.css` in `index.html` and `sw.js`'s app shell,
   read the owner's parts from `assets/skin/cards/` at start, and add a
   choice to Settings → The deck (the owner's art as one more back and
   face, the game's own kept). Bump `BUILD_VERSION` and `CACHE_NAME`.
   Nothing in the poker engine changes.
3. Open questions for the owner:
   - The four-colour deck setting recolours suits today; drawn suits keep
     their drawn colours. A second set of suit rows for four colours?
   - Court cards: an optional whole-card drawing (e.g. `cards-L-KS.png`)
     that overrides the built face for that card. The loader has room for it.
   - Bigger cells on the index sheet, if the owner wants larger ranks than
     today's.
   - The deck's edge (the stack under the top card) as a drawn part.

## Later parts, in order

1. **Keys, panels, dashboard, CRT frames** — these stretch, so they're
   9-slice: corners fixed, edges repeat, middle fills. Templates carry the
   slice lines; up and pressed states for keys. Follows the Pattern Book
   (one shared finish per part), so one drawing per finish covers every
   use.
2. **Felt and table rim** — tiles.
3. **Faces** — already files; templates are just the current PNGs.
4. **Coach set, coins, effects** — pick fixed frame sets first (coin spin
   frames, Coach boot frames), then template each frame.
5. Optional: a pixel font sheet for the readouts.
