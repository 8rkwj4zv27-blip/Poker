# Career Card Visual Lab — Pass 3

Owner-directed upgrade, 10 October 2026. The existing
`career-card-visual-lab.html` remains the review surface. Cabinet, instruments,
four-card arrangement, card dimensions and pickup/return routes are preserved.

## The four specimens

| Event | Corner / rim | Printed prize | Object treatment |
| --- | --- | --- | --- |
| Table Event | C / modest forest-green keyline | TOP PRIZE $300 | Cream invitation stock; proper five-card poker table illustration; quiet lift |
| Freezeout | R / rich blue rim with silver interruptions | TOP PRIZE $1,500 | Pale stock, dark blue ink, ice-bound chip stacks, directional silver glint |
| Bomb | C / forest-green index and keyline | TOP PRIZE $750 | Warm stock, two genuinely missing stepped corners, charcoal/rust cut edges, six escaping square embers |
| Wild Event | L / prismatic rim and high-contrast inset index | TOP PRIZE $10,000 | Strange house-face illustration, full-card foil, spectral print and finger-responsive reflection |

These are the owner's lab display prizes, not production event terms. The
large rarity labels are gone. Names remain in accessible labels; the compact
corner indices identify rarity visually. UC / teal is supported by the same
renderer and trim rules without adding a fifth display specimen.

## Physical construction and effects

Event identity, rarity and material have independent data fields. Rarity owns
the corner index and rim, event identity owns ink/stock/artwork, and material
owns the cut and reflective/thermal behaviour. Changing a Bomb to Rare changes
its rim without repainting its orange stock or illustration.

Every card has a clipped stock face, a matching offset thickness layer, and a
hard, zero-blur shadow. Bomb's two staircase bites remove actual card surface;
the background shows through. Authored SVG charcoal and orange lines follow
those bites. Particles are siblings of the clipped stock, anchored to the
damaged edges; they can rise and drift beyond the card. Six squares run two
finite sizzle cycles with two small heat pulses, then rest. The drawer does
not emit particles over its neighbours.

Wild's material reaches the rim, header, title, art, prize and supporting print.
A brief pickup sweep hands control to the finger when held. Direction, position
and intensity change together; the art coating, title and prize print catch
different parts of the reflection. Release returns to the quiet printed finish.
The L remains pale ink on a dark inset for reliable contrast. Freezeout uses
its own narrower, cool reflective treatment. Paper has no shimmer.

Pointer movement is batched into one update per animation frame and reads no
layout during dragging. There are no idle timers or indefinite particle/foil
loops. Reduced Motion retains the physical artwork, cuts and rarity print,
disables motion and particles, and keeps inspection/navigation usable. System
preference changes override the temporary lab switch.

## Artwork and visual review

All four illustrations are authored filled pixel clusters on the same 96×72
grid, using the production card/suit/felt palette and the established character
face grammar. Production menu and dashboard references in `docs/ui/references/`
were examined alongside the lab. No existing game artwork was changed; no AI
images, photographic textures, dependency, framework or external asset was added.

Captures live in `validation/career-card-visual-lab-screenshots/pass3/`:

- Drawer at 320×700, 375×667, 390×844, 393×852 and 430×932.
- All four inspected specimens at 390×844.
- Bomb with escaped embers.
- Wild held toward each side, showing different foil responses.

The original Pass 2 captures are retained in the parent screenshot directory.

## Verification and limits

The six-size browser review exercises 24 open/return cycles, no horizontal
overflow, card/control bounds, navigation wrap, keyboard arrows/Escape, focus
return, drag/release, finish replay, manual/system Reduced Motion and unchanged
localStorage. Dedicated material checks cover genuine missing corners, visible
escaped embers, finite particle rest, independent rarity trim, full-card foil
coverage and response, and stable cabinet geometry. Emulated touch checks cover
pickup, held foil/tilt, release and Close. JavaScript syntax and the 115 Career
event / 41 result checks pass before and after the upgrade.

Actual iPhone Safari/PWA feel and performance at 120Hz remain on-device review
items. CSS foil is an authored approximation of a reflective coating. Packets,
pack-opening sequences, feeding cards into the machine, playable Bomb/Wild
rules and inventory are not implemented. Production logic, economy, saves,
statistics, navigation, service worker and manifest remain unchanged.

Immediate next task for this lab: owner review of the upgraded card identities,
material desirability and on-device interaction. No production integration or
merge is approved by this pass.
