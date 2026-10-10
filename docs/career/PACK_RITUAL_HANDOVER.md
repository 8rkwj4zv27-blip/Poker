# Pack Ritual — handover to Opus

**11 October 2026. Isolated lab, not approved for production.** The owner
rated the previous Pack Ritual preview **6/10** and asked for a much more
polished, tactile opening moment. This pass improves and checks that build;
it does **not** establish a new owner rating or claim the requested 9.99/10.
The owner has now requested a quick wrap-up so Opus 5.5 can take over.

## Start here: baseline and branches

- Work on **`codex/pack-ritual`**, based on current `origin/main`
  **`18de0d4fd5681eedfc17c7ab6fc2c889269793a8`**, fetched and checked before
  this pass. Main had not moved. Production's exact build string is
  `v0.67.0-dev · Back Room builds a stack` in `js/02-support-systems.js`.
- Mac development checkout: `~/.codex/worktrees/pack-ritual/Poker`.
  The cloud agent needs only this GitHub branch; the Mac/server is not a
  dependency. Fetch and recheck main before continuing.
- **`checkpoint/codex-card-pack-labs-2026-10`** preserves the rejected
  card/pack labs on the old v0.35 base. Card/pack checkpoint `9162a32`;
  remaining local work preservation `c41e7f0`. Nothing was merged from it.
  The second commit preserves unrelated pre-existing dirty files too, so
  the old checkout could be left clean without losing work. Those files
  are a backup, not a proposed game update.
- `~/Documents/Poker` was 371 commits behind main. It must never again be
  treated as the current game's design/code baseline. The approved face
  and packet art were extracted as standalone placeholder assets; the
  stale game shell and chip implementation were not imported.
- Read `CLAUDE.md`, `docs/HANDOVER.md`, `docs/QUICKMAP.md` and
  `docs/ui/PATTERN_BOOK.md`. Refer to archived approved motion labs via
  `docs/CODEMAP.md` and the archive branches/history, not the stale checkout.

## Run and publish

From this branch's root:

```sh
python3 -m http.server 8768
# Open http://127.0.0.1:8768/pack-ritual-lab.html
node validation/tools/lab-bundle.js pack-ritual-lab.html /tmp/bundle-pack-ritual
```

The bundler succeeded: **167 accompanying files, 5.4 MB**. It reads the
`lab-inject` JSON and bakes the injected game into `game.html`, stripping
SW registration and the listed Home boot script. The host uses
`window.LAB_STATIC` when published, and a fetched `index.html`/srcdoc copy
locally. Opus can rebuild the bundle anywhere. No Mac absolute path appears
in the lab or publishing manifest.

**No Artifact has been published.** This agent has no Artifact publishing
tool; the owner explicitly requested a bundle check for Opus to publish.
Follow CLAUDE.md's private Artifact workflow with the staged lab, bundle
root and `files.json`, then record the phone link here.

## Files and dependencies

Lab-owned files:

| Path | Responsibility |
| --- | --- |
| `pack-ritual-lab.html` | Full-screen phone iframe; lab-inject CSS/JS and strip list |
| `js/pack-ritual-host.js` | Current-game copy, in-memory Storage shim, no service worker |
| `js/pack-ritual.js` | State machine, object poses, gestures, rewards, session collection, lab controls and audio |
| `css/pack-ritual.css` | Scene/object layout, contact shadows, card planes, wrapper, foil and effects |
| `js/pack-ritual-art.js` | Previously approved foil packet SVGs only |
| `js/pack-ritual-cards.js` | Frozen 4-event × 4-rarity placeholder faces/data API, `PokerCollectibleLab` |
| `css/pack-ritual-cards.css` | Frozen approved face styling; includes some unused original lab-shell selectors |
| `validation/pack-ritual-touch-checks.cjs` | Separate Playwright touch flow checks and stage capture generation |
| `validation/pack-ritual-captures/` | Phone stage PNGs, QA results and bundle manifest |
| `docs/career/PACK_RITUAL_HANDOVER.md` | This document |

Updated supporting files: `validation/tools/touch-harness.js` adds an
optional installed-browser `executablePath` argument; default cloud
behaviour is unchanged. `docs/HANDOVER.md`, `docs/QUICKMAP.md`,
`docs/CODEMAP.md`, `docs/README.md` and `docs/career/STATUS.md` identify this
isolated work and its next review. Home Cast remains loaded because the shared `wireUI()` calls
`initHeroFaces`; stripping it caused a console error caught by touch QA
and corrected before delivery. No production JS/CSS, `index.html`,
`sw.js`, poker logic, save schema or release number is changed.

The inherited game copy loads exactly the scripts/styles in `index.html`,
except the stripped Home boot script. The complete bundler dependency
inventory is committed as
`validation/pack-ritual-captures/bundle-files.json` (regenerate from the
bundler's `files.json`). Principal reused parts:

- `css/00-visual-tokens.css`, `css/01-machine-components.css`,
  `css/06-machine-system.css`: fonts, housing, main/secondary keys and lamps.
- `css/02-screens.css`, `css/career-hub-v2.css`,
  `css/career-hub-cabinet.css`: actual felt and bankroll reel.
- `css/crt.css`, `js/crt.js`: unchanged CRT glass and text roles.
- `css/press-feel.css`, `js/press-feel.js`: shared sink/spring/sounds.
- `js/02-support-systems.js`: shared settings, sound and game assets.
- `js/coin-world.js`, `js/coin-table.js`, `js/coin-bank.js`, their styles:
  current raster chip art, denominations, contact shadows, flight physics.
  `CoinWorld.composeTiers`, `makeChip`, `body`, `launch`, `setHost`,
  `buildWalls`, `clearWorld` are used directly. No old chip PNGs.

## Architecture and loop

Phases: **choose → selected → sealed → open → cards → review → filing →
choose**. Inspection is a temporary mode inside `cards` or `review`.

Three packet objects land; selecting one lifts it and moves the other two
away. BUY deducts the session wallet and rolls the existing reel, then
pops/turns the selected packet. Four persistent card DOM objects are placed
in its clipped `pr-pocket`, between lining/mouth and wrapper front. The
finger tears a stepped seam; the matching detached strip is a separate
object. Pulling lifts that same stack through the mouth. At extraction,
the same card nodes are reparented to the felt using their measured visual
positions; they are not replaced by unrelated reveal sprites.

Each object has position, height, scale, roll, yaw, pitch, opacity and a
separate ground-shadow object. Movement is continuous; automatic plane
poses sample at 14 fps. Finger handling updates the plane directly.
Card stock uses six depth layers, a neutral back, front foil and far-edge
shade. Inspecting lifts that same card and parks/dims the other cards;
closing restores their poses. TURN OVER is manual only, with no event
information printed on the back.

A sideways flick makes a short arc to a visible received pile. Common is
quiet; Uncommon has a small lift; Rare gets a short blue reveal; Legendary
lifts and glows for roughly 1.05 seconds with an event-coloured felt
reflection, edge aura, pixel particles and finite foil sweep. Bomb uses
embers; Wild adds a short colour misregistration. Inspection foil follows
yaw/pitch. Reveals can be advanced immediately; `clearReveal` invalidates
old effect callbacks. Audio is supplemental.

After the second card, a handful of production chips launches from the
slumped wrapper mouth and lands near it. No chip sleeve or invented token
is introduced. After all four, the cards spread into a two-by-two haul.
ADD TO COLLECTION squares, turns and files them into the temporary session
collection key; chips fly into the bankroll. Fresh packets land.

The small TUNE key offers mixed/rotating events, forced Legendary event
kinds, all-common and double-Legendary fixtures, sound/reduced motion,
reset and test credits. Busy transitions disable tuning/reset and keys. Reduced-motion manual
turns resolve immediately rather than leaving a delayed partial turn.
The scene frame stays fixed; overflow is clipped to prevent browser focus
from scrolling the cabinet when objects travel beyond it.

**Isolation:** wallet starts at $5,000; packet prices $100/$300/$1,000;
extra chips $40/$75/$150. These and prizes/venue/seat counts are illustrative
fixtures, not approved economy or real event terms. The four mixed packs
rotate through all 16 event/rarity faces. Wallet, collection and fixtures
are session variables; Storage in the game iframe is an in-memory shim.
Reload discards finds. No production save writes or Career transactions.
The collection grid is a temporary handoff, not the future Archive design.

## Owner feedback and decisions — do not repeat these mistakes

1. Early event-card work improved through passes 3–6: larger Bomb cinders
   and genuinely cut silhouettes; whole-card foil; C/UC/R/L corner marks,
   prize on the body; increasingly upgraded rarity construction. The owner
   approved the later direction. Legendary Bomb should feel dangerous;
   Legendary Wild should feel strange/crazy. Preserve the supplied faces
   for now: **the owner will illustrate the cards himself**.
2. First pack opening pass was **rejected**: weak fake tear; cards appeared
   behind the wrapper, not inside; cheap automatic card flip and fly-away
   next transition; no useful handling; weak rare moments; poor chips and
   cosmetic swatches; generic screen/hub. The optical reader was described
   as cheap and unrelated to the game. The owner preferred info above/below
   the lifted inspect card, possibly with controllable 2.5D rotation.
3. The owner requested inspecting the older Opus Pack Lab. It was closer
   in feel despite issues. Its old chips must **not** be reused. Archived
   Coach Rig, Bank Load, End Screens and the shipped deal motion provide
   useful references for causal secondary motion and shared components.
4. Second pack opening pass was also **rejected**: stale v0.35 baseline,
   invented wooden “THREE PACKETS. PICK ONE UP” strip, inconsistent keys,
   wrong old chip art, no convincing contact shadows, weak rare reveal.
   The Git audit/tidy did not justify using the stale checkout. The owner
   was angry about the lack of current-game consistency and repeated
   promises of quality without a satisfying result.
5. Required build is a **moment**, not another UI proposal: packets land;
   purchase feels physical; tear/pull; quiet Commons; “ooh” Rare; a
   Legendary pop/glow; admire the tangible foil card; flick to the visible
   pile; spread the haul; collect; repeat. Tactile, physical, retro, fun,
   polished indie-game quality; satisfying hundreds of times. Balatro was
   cited as a quality benchmark, not a request to copy its UI.
6. Current Pack Ritual preview was rated **6/10**. This pass targets
   typography, real-feeling 2D weight, shadows, reliable layout and readable
   reveals, while matching the current Pattern Book. The owner has not
   yet rated this revised pass and now wants Opus to inspect/take it further.

Binding decisions: **no printed event-details reverse; no optical reader;
info in inspect mode; owner-created final card art; archive screen not yet
designed; approved packet art kept; use current gameplay chips.** No vendor
machine, cosmetics or new currencies are in this focused opening study.

## This pass: critical assessment

| Requirement | Change and current assessment |
| --- | --- |
| Stable scene | Fixed a multiplying requestAnimationFrame chain and browser-focus scrolling. Status/footer now reserve fixed height. Full touch loop checks the felt does not shift. |
| Typography | Removed local CRT font-size overrides; shared Line/Caption/Figure roles. Inspection prose wraps, with venue/prize/seat/rules visible. Header fits phone width. |
| Physicality | Re-centred projected contact shadows, shaped card shadows, stepped plane shading, thicker stock. Packet entry accelerates into contact/rebound; purchase hops/turns; cards arc to the pile. Better causal weight, but physical-device feel still needs owner judgment. |
| Rip/extraction | Finger-driven jagged cut, detached strip, lining/dark mouth and occluded card stack. Persistent nodes move out without a sprite swap. Wrapper is still a stylised CSS construction, not a simulated flexible mesh. |
| Silent rarity | Distinct finite blue Rare and brighter event-coloured Legendary lift/glow/foil/particles. Verification checks visible effects with sound switched off. No rating claimed. |
| Current chips | Live denomination renderer and physics, exiting wrapper mouth; short separate “house extra” beat. Layout is intentionally messy; bottom pile/wrapper/labels still deserve composition review. |
| Inspection | Same physical card, stock edge, angle-linked full-face foil, manual reverse, restored pose, readable event details. Uses CSS perspective, so iOS backface/compositing needs device testing. |
| Collection finish | Haul spread, duplicate/new labels, square/turn/file, chip bank transfer, fresh packet drop. Only a session collection stub; no real Archive/save integration. |

## Verification evidence and limits

- Before pass: **25/25 npm test suites green** (245 seconds).
- After pass: the full regression run passed 24/25; only the main
  handover’s 83-line length failed. Shortened it and reran the version
  suite (all seven assertions passed) and quick suite (22/22). The three
  long simulations already passed; all 25 suites are verified green
  across that run/rechecks. Full detail: `validation/pack-ritual-captures/CHECKS.md`.
- Final touch suite passed at both sizes and reduced motion, with no
  console/page errors. Four mixed packs exposed all 16 combinations.
  Results: `validation/pack-ritual-captures/QA.json`; all 32 numbered
  screenshots are committed. Bundler succeeded on the final source.
- Touch harness drives actual emulated touch at **390×844 and 375×667**:
  partial seam drag, extraction, flick, same-object inspection, angle and
  reverse, reinspection from the haul, filing, bankroll/reward arithmetic,
  real-storage isolation, stable felt, current chips, repeated mixed packs
  covering all sixteen combinations, and reduced motion.
- Screenshots are numbered by stage for each normal-motion phone size:
  packets, buy, mid-rip, mouth, extraction, Common, inspect, angle, reverse,
  Rare, Legendary, chips, spread, Legendary inspect, filing, collection.
  They are evidence of those frames, not proof of fluid timing or delight.
- Also played the basic loop in the in-app preview, inspected captures and
  corrected clipped prose, extra packet intrusion and shifting layout.
- **Not verified:** real iPhone/Safari/PWA feel, 120 Hz display behaviour,
  audio quality/speaker mix, haptics, battery/GPU cost, Artifact-app rendering,
  sustained hundreds-of-pack enjoyment. No production integration tests
  beyond the existing suites; no real save/archive functionality exists.

To reproduce touch checks (requires an already installed Playwright runtime
and Chromium, no package changes):

```sh
PACK_RITUAL_URL=http://127.0.0.1:8768/pack-ritual-lab.html \
  node validation/pack-ritual-touch-checks.cjs
# If Chromium is elsewhere, set PACK_RITUAL_BROWSER=/path/to/chromium.
# The shared touch harness defaults to /opt/pw-browsers in the cloud.
npm test
```

The browser suite is deliberately separate from the dependency-free
`npm test`; do not claim npm test exercises the full opening interaction.

## Prioritised next steps for Opus

1. Publish the bundle and **play on the owner's phone**. Obtain the actual
   revised verdict before calling the design approved. Compare it directly
   with current gameplay and the approved archived labs; judge movement,
   contact, anticipation, fatigue and hand feel, not only still images.
2. Tune timings/secondary motion from that evidence: seam resistance and
   strip recoil, extraction drag, card-stack contact and Rare→Legendary
   rhythm. Keep immediate advance; avoid forced slow theatre every pack.
3. Review bottom composition: chips should visibly emerge from the mouth,
   then clear the haul labels; foil should remain readable at all angles.
   Check Safari stock edges/backface and small-phone inspect geometry.
4. Audio and haptics on device: a restrained, varied paper/contact palette
   and a coherent Legendary accent. Current procedural sound is provisional.
5. Clean the face stylesheet's unused old shell selectors; refactor the
   long scene functions only where it makes iteration safer. No framework
   or dependency migration. Expand input/resize/focus/accessibility testing
   if production integration is proposed.
6. Agree economy, packet contents, actual event terms and Archive design
   separately. Integrate only after owner sign-off; update Pattern Book for
   genuinely new shared components then, not by silently replacing finishes.

Everything needed to inspect/build this lab is on the branch. Nothing in
this handover authorises merging the backup branch or shipping the lab.
