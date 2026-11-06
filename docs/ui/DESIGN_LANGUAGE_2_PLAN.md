# Poker Faces — Design Language 2 ("from HTML game to Switch game")

> **Status (6 Nov 2026):** approved by the owner. Step 1's lab is built: `look-dev-lab.html`
> (`js/look-dev-light.js`, `js/look-dev-lab.js`, `css/look-dev-lab.css`), published at
> https://claude.ai/artifact/KbFvM26Y1b7EdkhzFPf24X. Waiting on the owner's verdict from the phone.

## Context

The moments library and the two blind passes (owner + Claude, gallery:
https://claude.ai/artifact/YE8yzWEAMVrSzSBZRwy2Bs) agree the core is fun but the game reads as "an HTML-coded game"
rather than something you'd see on Switch or Apple Arcade. The owner is now willing to look past the current Pattern
Book and upgrade the design language itself. The owner's steer (6 Nov):

- **Keep:** the enemy seat panels and face size; the felt mostly as it is; the identity (velvet machine, Poker Faces).
- **Explore:** pixel 2.5D art with dynamic lighting that behaves like a 3D game; new fonts (especially the event
  cards and tickets); lots of small animated details; moments that are satisfying, neat and fun to watch.
- **Fix:** visual noise. Examples: the showdown win (the same fact said five times), the EVENT LOST stage (six framed
  boxes of labels), and the AWARD scatter (chips littering the whole board).

The Polish Audit (`docs/ui/POLISH_AUDIT_PLAN.md`) continues as the record. This plan is the next step: decide the new
language on one small slice of the game, at full quality, before rolling it out.

## Why it reads as HTML (the diagnosis that drives the plan)

1. **Mixed pixel grids.** Cards, faces, chips, fonts and frames are each drawn at a different pixel scale; some text
   is smooth vector type (the "Queens / WON" lines) next to hard pixels. Shipped pixel-art games put everything on one grid.
2. **Boxes in boxes.** Information is grouped with bordered panels three or four deep, each with a letter-spaced
   label. Games group with space, light and objects, and carry information on the things themselves.
3. **No light.** Flat fills and the same CSS drop shadow everywhere. There's no light source, so nothing has form
   and nothing can be lit up for drama.
4. **Everything at once.** Results, readouts and effects arrive together. Games stage information in beats, revealed
   one at a time.
5. **Motion without the animation principles.** Things fade or slide in on generic easing: no anticipation, overshoot,
   squash, hit-stop or follow-through, and nothing moves while you wait (no idle life).
6. **Effects without hierarchy.** The award physics is impressive but uncontrolled. Juice should point at one thing.
7. **No camera, no focus.** Nothing pushes in, settles or blurs the background when a moment matters.
8. **Sound off.** Half of "feel" is missing by default.

## The new language (proposed principles, to be proven on the slice)

1. **One pixel grid.** A fixed art scale (proposal: 1 art pixel = 3 screen points on the phone). Every sprite, font and
   border snaps to it; integer-only font sizes; no vector type in play.
2. **Light, not boxes.** A lamp above the table is the main light. A pool of warm light on the felt; objects cast
   shadows away from it; cards and chips catch a specular glint that moves with their position; ambient occlusion
   under seats and cards. Lighting is also how drama works: the lamp brightens on a win, gutters on a bust, and
   spotlights the winning hand while the rest dims.
3. **Say it once.** Each moment has one headline, one number and one action. Everything else is shown on the objects
   (the cards glow; the beaten seats dim) instead of being written again.
4. **Beats.** Big moments are sequences: anticipation → hit → settle. Each beat lands on its own, with its own sound.
5. **Three voices of type.** Machine (CRT readouts), Print (tickets and event cards: a letterpress/receipt pixel face)
   and Marquee (big headlines). Each voice has one face and two sizes.
6. **Always a little alive.** Faces blink and breathe, the lamp flickers slightly, CRTs shimmer, the deck settles,
   chips glint. It stays quiet; it is never noise.
7. **Restraint.** At most one effect fights for attention at a time; nothing litters the felt after it settles.

## Step 1 — The slice (one lab, phone-first, published as a link)

`look-dev-lab.html` (the pattern of `showdown-lab.html` + `js/showdown-lab-host.js`, injected into the real game via
`lab-inject`, a TUNE key and bottom sheet) rebuilds **a whole hand, start to finish** (owner's choice, 6 Nov) in the
new language: the deal, the betting streets, the showdown, AWARD and the chips into the bank. It runs inside the
game, so everything around it stays real, with a before/after switch in the sheet. Lighting: **both candidates are
built and compared** on the phone (owner's choice). The EVENT LOST redesign moves to the first rollout step,
since the slice is now the table.

The hand, beat by beat:
- **The deal:** cards leave the deck with a small lift, cast a shadow, land with a tiny settle and glint; your two
  cards turn with a beat of anticipation.
- **Betting:** chips slide to the bet spot as a little stack with a click; the seat whose turn it is is picked out by
  light (not only a frame); the console says each thing once; faces get idle life and react to bets.
- **Streets:** flop, turn and river land with distinct beats; the hand readout grows in presence with the hand's strength.

What the slice contains:
- **Lighting layer**, two candidates switched in the sheet:
  - A. DOM fake-3D: a dithered light pool on the felt, a per-object shadow and glint offset computed from each
    element's position relative to the lamp (CSS variables set by a small JS module), lamp intensity as a variable for drama.
  - B. A WebGL layer under the cards for the felt, chips and deck with hand-drawn normal maps and a real point light
    (no libraries). Kept only if it clearly beats A and holds 60fps on the owner's phone.
- **Showdown choreography:** cards turn one at a time; the five that play lift and catch the lamp; beaten hands dim
  and the faces react; one stamped plate with a hit-stop frame and a 2-3% camera push-in; COLLECT.
- **Award choreography:** the pot slides toward you as one mass; chips peel off into the bank in a tight arc, each
  ticking the stack reel up; 6-10 sparks, no litter; the lamp warms for half a second.
- **Noise pass on the console:** one headline, one number, one key; the duplicate readouts ("QUADS WINS", "YOU WIN THE
  POT", seat labels "FULL HOUSE BEATEN") are dropped or moved onto the objects.
- **Type audition:** two or three candidate pixel faces for each voice (Print especially), on the ticket and an event
  card, bundled locally as the current fonts are (embedded in `css/01-foundation.css`).
- **Sound for the slice:** the cues it uses, re-tuned, so the owner judges with sound on.

Deliverable: the lab link on the phone, a before/after clip pair (`moments.js --video`), and a one-page
"Design Language 2" draft (the principles above, with the numbers that worked: grid, light, durations, easing, type sizes).

## Step 2 — Write the language down

Once the owner signs the slice off: `docs/ui/DESIGN_LANGUAGE_2.md` (grid, palette with lit/shadow ramps, light rules,
type voices and sizes, motion beats and timings, the "say it once" rule, idle-life rules). The Pattern Book gets a
"V2" section and its checks (`validation/pattern-book-checks.js`) learn the new rules. The old parts stay until each is
migrated.

## Step 3 — Roll out by area (each a lab, then a release)

In priority order from the audit: the table's remaining moments (all-in, K.O., fold win) → result stages, starting
with EVENT LOST rethought (the headline; one big fact such as 2ND OF 2 and Harry's face saying GOT YOU; the hand that
beat you; the luck meter kept as its personality; the rest revealed one beat at a time; the console under it given a
job), then cleared, run over and event won → Career hub and cards/tickets (new Print type, lighting on the felt) → main menu → the form-like
screens (Rankings, Custom Game "choose your enemies", Settings, Workshop) → sound pass and store-readiness. The
moments library is re-shot after each release, and the gallery shows before/after.

## Constraints

- No new dependencies without approval: any font files or audio files come to the owner first. WebGL is plain browser
  API, no library.
- Poker logic untouched; presentation only. Saved settings and stats preserved.
- iPhone performance is a gate: the slice must hold 60fps in the touch harness and on the owner's phone, with a
  Reduced Motion path.
- Follows CLAUDE.md's lab rules (phone-first, published link, `lab-bundle.js`), and every release bumps
  `BUILD_VERSION`/`CACHE_NAME` and updates the handover.

## Verification

- `npm test` and `npm run play-test` green; the lab checked in `validation/tools/touch-harness.js` at 390×844 and 375×667.
- Frame timing measured in the lab (a frame-time readout in the TUNE sheet).
- Before/after clips of the same hand from `moments.js --video`.
- The owner's verdict on the phone decides; nothing reaches the game until signed off.
