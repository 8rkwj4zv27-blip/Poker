# Career Mode — Current Status

## Career Hub ticket reader — production integration (2026-09-23)

The owner approved replacing the V2 Career cassette directory with the tested
ticket-reader Lab. The live Career screen now uses the six distinct ticket
stocks, side navigation, a continuous physical card turn, fixed seven-drum
bankroll, two-stat CRT, intake/return entry motion and table-style primary
press. The Lab Exit was removed. The live screen keeps the existing bottom Back
route; active events also retain Continue / Abandon, and active cash keeps
Resume / Cash Out. The real Career entry and cash functions remain the sole
source of debit, seating and settlement. Entry motion never debits a fixture.

The owner-approved corrective pass removes the broken card-face flash, makes
the ticket visibly descend behind the intake lip, rolls $100 entries in ten
$10 display steps after successful acceptance, and keeps the primary key out of
the home-screen VHS launch effect. Compact phone layouts use a shorter ticket
grid, preserving both the front and the readable details reverse. The earlier
Lab-only and V2 production descriptions below are historical checkpoints;
this integration supersedes their screen-layout and immediate-next-task notes.

Validation: 115 focused Career event checks and 41 Career result checks pass;
live browser QA at 430×932, 390×844 and 320×700 covered both card faces,
controls, and a live paid event on an isolated origin. Reload showed $400 from
$500 after one $100 entry, the same active event, Continue and Abandon. The
next task is on-device PWA feel and sound verification, then any owner-directed
fine polish—not another catalogue or economy expansion.

## Career Hub V2 UI Lab prototype — COMPLETE (2026-09-22)

The owner-approved machine-intake polish pass is now in the isolated Lab. The
bankroll plaque has a defined place beside, rather than beneath, the Exit key;
the seven fixed drums, two-stat CRT and primary cartridge have measured bottom
clearance at 320, 375, 390 and 430px. Short screens scroll the complete cabinet
instead of cropping its action. Ticket stock is flat rather than edge-bevelled.
Existing resident portraits make brief, irregular same-character expression
changes on available fronts and rest during flips, browsing, entry and Reduced
Motion. The redundant feeder above the ticket is gone. A dark intake immediately
above BUY IN receives a downward-moving copy of the invitation; only after it
is accepted do the bankroll drums roll and the paid state settle. The Lab
fixture charges exactly once and blocks browsing and repeat entry during the
sequence. This is still a visual fixture, not a production transaction: live
integration must take its success/debit signal from Career's authoritative
entry path. Validation: 115 Career event checks, 41 result checks, JavaScript
syntax, visual/geometry checks at four phone widths, compact Back Room and
Invitational reverses, normal and Reduced Motion entry, and no browser errors.

An isolated, interactive `career-hub-v2-lab.html` prototype now explores the
owner-supplied event-card direction at the 430×932 phone target. The approved
continuity revision preserves the real pointer drag/flick/snap browsing but
removes the artificial venue-tab pile: only one invitation is complete, with
the immediate neighbours clipped at the reader edges and every other card off
stage. The latest polish pass turns the top into one coherent player dashboard.
The bankroll and two-stat CRT are equally justified full-width instruments;
the small Exit key now occupies its own balanced utility row in the established
Settings-key grammar and never overlaps either instrument. The fixed
seven-drum bankroll has a clean flat gold perimeter, dark glass well and
staggered roll response, so `$0000500` changes value without changing shape.
The rectangular CRT automatically cycles four pairs of truthful fixture stats
with the existing phosphor, scanline, cursor and refresh language and advances
on touch. Its refresh is scoped to the glass and cannot flash the chassis or
gold bankroll trim. Event navigation remains mounted as small physical tabs on
the card-reader sides rather than as a detached row.

The Lab loads the production stylesheet stack and directly reuses the game's
bankroll reels, CRT display grammar, icon keys, primary cartridge, materials,
typography and press travel. Redundant branding, slogans, plaques and footer
copy remain removed. A lower intake now gives the invitation a machine
destination, and selection gets a short paper-settle response. The six venues
share one disciplined information grid but now rise through visibly different
ticket-production standards: clean ruled Back Room note, perforated oxblood Pub
admission, green membership docket, black-and-gold Casino ticket, dark charcoal
and silver High Roller stock, and a double-bordered deep burgundy-and-gold
Invitational. The accidental Back Room punch hole and diagonal crease are gone.
The universal gradient metal venue plaque is gone; venue identity is printed,
stamped or formalised directly into each ticket. Adjacent ticket peeks expose
those changing materials before selection, while restrained reader lighting
follows the chosen venue.

DETAILS is now a narrower reinforced paper tab and turns to EVENT on the reverse.
A 620ms perspective turn lifts the ticket, narrows it to a physical edge,
changes face without mirrored text, and settles the reverse; Reduced Motion
collapses that sequence. It opens a legible event brief rather than a matrix of equal boxes: format and a
plain-English explanation, specification rows, payout/table rule, then buy-in
and access. Decorative crop marks are gone, status marks are front-only and now
behave like ink, punches or access marks applied to the stock, and a previously
completed event still reads BUY IN / TAKE SEAT rather than REPLAY. Swiping
restores the next card's front. Available, unaffordable, locked, completed and
paid primary-key states are visually distinct. The primary cradle now preserves
its full bottom plinth and safe edge clearance at every tested phone size. Dev
controls remain available only with the explicit `?lab` query and never intrude
on the player-facing test URL.

The prototype loads no production JavaScript and reads or writes no Career
save, localStorage, event transaction, navigation, poker, AI or economy state.
The 14 / 5 / 9 record is deliberately a Lab fixture; production integration
must settle what counts as Lost before deriving it from the existing counters.
Production Career remains the `v0.34.0-dev` implementation described below.
Validation passes **115** focused Career event checks and **41** Career result
checks. Browser QA at 430×932, 390×844 and 320×700 found no page overflow or
console errors; the equal-width dashboard, fixed reel, tap/automatic two-stat
CRT cycling, all ticket tiers, compact Invitational reverse, full primary-key
plinth, side tabs, touch flick, card turn, completed and paid paper marks,
visual entry and unchanged localStorage were exercised. Immediate next task
for this prototype is owner creative-direction review; do not integrate it into
production without explicit approval.

## Poker Faces V2 Career production pass — COMPLETE (2026-09-21)

Career now opens as the player's single-player headquarters rather than a long
database-like event list. The status instrument was compressed without removing
bankroll, cash ownership, permanent access or aggregate results. All six venues
remain present in a restrained circuit strip; the complete live catalogue now
occupies a horizontal snapping cassette rack; and one selected event feeds a
central reading bay with prize/stakes, entry, field, opponent preview, real
availability requirement and the primary action before progressive details.

Browsing uses short stepped lateral travel and a settle beat. Locked events are
duller previews rather than full-size obstacles. Active tournament and cash
sessions take focus automatically. TAKE SEAT / CONTINUE / BUY IN / RESUME reuse
the existing transaction and launch paths, with a short clamp-and-dim transition
into the existing poker table. Reduced Motion makes the hand-off immediate.

No Career descriptor, economy, progression rule, roster, save field, cash
ledger, poker rule, AI behaviour, scoring path, opponent emotion system or table
presentation changed. Save schema remains v6. The release marker is
`v0.34.0-dev · Poker Faces V2 Career`; service-worker cache is `poker-v34-0`.

Validation: **115** focused Career event checks and **41** Career result checks
pass; JavaScript syntax checks pass. Real-browser QA at the requested 430x932
target covered initial state, several selections, locked preview, detail open /
close, TAKE SEAT, table entry, reload-to-active focus and Back navigation. The
document and Career screen had zero horizontal overflow, the primary action was
inside the initial viewport, and the browser console had zero errors. Venue
stops were raised to a 44px touch target after measurement.

Immediate next task: on-device iPhone/PWA feel and sound verification. Do not
continue into another Poker Faces V2 area without a new owner request.

Last verified: 2026-09-03
Verified working-tree implementation: Upper Ladder Pass, built on the
committed `ed0f5d6` Career presentation baseline. Build
`v0.28.0-dev · Upper Ladder Pass`, service-worker cache `poker-v27-0`,
Career save schema **version 6**.

This is the short handoff file. Update it whenever a Career milestone is completed or the immediate next task changes.

## Upper Ladder Pass — COMPLETE (2026-09-03)

The owner approved the proposed **2 / 2 / 2 / 1** upper-room structure:
Card Club adds Club Six beside Deep Stack; Casino Floor adds Main Event and
Midnight Turbo; High Roller adds Feature Table and Pressure Five; Invitational
Championship contains one event, The Final. First place in any event at a venue
unlocks the next venue. Expert and Elite must remain public-state-only and the
Invitational adds a persistent Champion result plus a one-time Final Table beat.

The pass is implemented through all venue gates. Card Club now offers Deep
Stack and Club Six; Casino Floor offers Main Event and Midnight Turbo; High
Roller offers Feature Table and Pressure Five; the Invitational contains The
Final. All seven upper events use the approved fields, stack/cadence values and
no-rake payout arithmetic. Any first place opens both events in the next venue;
paid lower places move money only.

Expert and Elite extend the existing honest AI with more stable equity sampling,
less decision noise and stronger public position weighting. Curated fields use
only the existing archetypes. The Invitational is one continuous event: crossing
to three or two players fires one saved Final Table beat without resetting poker
state. The first win records persistent Champion status and gets a dedicated
CHAMPION result; later wins remain replayable ordinary event wins.

Save schema v6 adds only the Champion boolean. Migration copies existing money,
active-event terms, counters, cash state and rosters, and advances upper access
only from a provable recorded venue win. The installed build/cache markers were
bumped so the pass reaches PWAs.

Owner visual review then removed the redundant Recommended / Alternative / Next
Target instrument and replaced the standalone Cash Table promotion with the
first cassette in the Back Room rack. Its `CASH` flag and `$50 BUY-IN` label
distinguish it from freezeouts; opening it reveals the same printed-ticket and
machine-control hierarchy as every event. Cash entry, resume, cash-out and ledger
rules are unchanged.

Validation at completion: **112** Career event checks, **41** Career result
checks, **170** scoring checks, **20** gameplay-format/AI checks, **8** chatter
isolation checks, and **0** scoring-audit divergences. JavaScript syntax checks
pass. Browser automation could not reload the existing `file://` preview because
that URL class is blocked by its safety policy, so a manual responsive look at
320 / 375 / 390 / 393 / 430 px remains the immediate presentation gate.

Immediate next task: manually inspect the expanded directory at the five iPhone
widths, then use real sessions to tune Expert/Elite pace and upper-table balance.
Do not add more upper content before that evidence.

## Holiday Gameplay Pass — COMPLETE (2026-09-03)

The owner explicitly reprioritised the roadmap and the sequential pass is now
implemented: (1) Back Room cash and safe Cash Out, (2) shared Turbo / Deep Stack
/ Heads-Up formats, (3) one playable Card Club destination, (4) bounded pacing
instrumentation and contained AI corrections, and (5) full automated validation
plus responsive rendering at 320 / 375 / 390 / 393 / 430 px.

Cash entry and settlement are atomic and idempotent; a corrupt session refunds
only a provable recorded buy-in; cash and tournaments are mutually exclusive;
and the Board distinguishes available bankroll, on-table money, and total owned.
Pub first place permanently unlocks Card Club Deep Stack. Local measurement
keeps at most 100 hands and 30 conclusions per format and records duration,
non-decision share, flop reach, and hands to conclusion without adding a new
analytics dependency.

Validation at completion: **104** Career event checks, **39** Career result
checks, **170** scoring checks, **18** Holiday gameplay checks, and **0** scoring
audit divergences. JavaScript syntax checks pass. Responsive rendering has no
horizontal overflow on any required width.

The Holiday pass's next-task instruction was superseded by the owner-authorised
Upper Ladder Pass above.

This completion block is the previous handoff. Lower dated milestone narratives
and the old numeric phase table are archival snapshots and must not override the
Upper Ladder completion block above.

The paused chatter prototype and every untracked Lab remain out of scope and
were preserved. Baseline before implementation was 87 Career event checks, 39
Career result checks and 170 scoring checks, with 0 scoring-audit divergences.

## Direction update — 2026-08-25

The expanded Career direction (the soft poker RPG) was **approved by the owner
and promoted into `CAREER_DESIGN.md` and `BUILD_PLAN.md` on 2026-08-25.**
`BUILD_PLAN.md` now carries the complete sixteen-phase sequence.

Phase 2 (Second Chance) was implemented the same day — see *Implemented now*
below. Scoring specification, scoring correction, the contextual Recommended /
Alternative / Next-target selection, Full Circuit, pacing instrumentation, named
residents, the boss seat, the Back Room cash table, dossiers, titles, trophies
and cosmetics remain **all unbuilt**.

The Career save schema is **version 4** as of the owner-directed Career event
directory milestone below, which added `eventsPlayed` and `eventsWon` and nothing
else. Phase 2 itself required no bump: a saved career missing the new
`unlocks['second-chance']` key fails `isValidCareer()` and is carried through the
existing `migrateCareer()` path (the same mechanism that added Pub Circuit Open in
Phase 1), which is exercised by a dedicated check. The next bump is Phase 9's
cash-session state.

**Phase 3 (scoring specification and audit) and Phase 4 (scoring correction,
gates 4A–4D) are both CODE-COMPLETE as of 2026-08-26 — see below. The six owner
decisions in `docs/scoring/SCORING_SPEC.md` section 9 were settled and approved
on 2026-08-26 and are implemented. Rendered verification of the Phase 4
correction is the immediate next task; Phase 5 — Contextual Board and visible
Full Circuit — follows only after that manual gate passes.**

## Owner-directed pass — printed event tickets and menu consolidation (2026-08-27)

Shipped as `ed0f5d6`. Approved from the Ticket Lab prototype and integrated. Build
`v0.26.0-dev · Event UI Update`, service-worker cache `poker-v25-0` — the
cache bump is what delivers this to installed PWAs. (It first shipped in
`ed0f5d6` as `v0.25.0-dev · Printed Tickets` and was relabelled on the same
day; the pass itself is unchanged.)

**No Career economy, event availability, roster authority, save structure,
entry charging, settlement, payout term, venue id, opponent artwork,
personality identity or poker rule was changed.** No event difficulty, AI
behaviour or threat label was touched either — see the threat-ladder issue
below, which was recorded and deliberately not acted on.

### 1. Home screen — two play routes

Career is the featured cartridge (`Career` / `Build your bankroll`, and
`Event in progress` when one is live). `Custom Game` is the single
secondary route, carrying **one word** — the subtitle element is removed,
not emptied, so nothing occupies space or affects alignment.

SINGLE PLAYER, CLASSIC TABLE SETUP, NEW GAME and the menu-resident 4/5/6
opponent picker are gone from the menu. **No gameplay code was deleted:**
`startSinglePlayerRun()`, `startGame()` and `continueTable()` are untouched
and are now reached from Custom Game.

**Custom Game** is the one place a standalone table is configured. Its
Game Type selector is Cash / Tournament / **Elimination**, with no
unfinished future mode advertised. Elimination withdraws the stack and
blind panel (it fixes its own stakes from `ELIMINATION_CONFIG`) and offers
the three sizes a run can actually build, stored in a new
`settings.runOpponents` so it never overwrites the cash table size.
`settings.mode` is **never** set to `elimination`, so every existing caller
of `startGame()` — Quick Deal included — can only ever be handed a mode it
can build. A saved table is never stranded: Custom Game shows it and
offers Continue, through the same `continueTable()` the old menu button
used.

### 2. Featured-button clipping — root cause and fix

`.pc-primary-cradle` was a shrinkable flex item inside a bay with
`min-height:0; overflow:hidden`. On a short phone the cradle collapsed
**117px → 39px** and its own `overflow:hidden` then cropped the 78px
cartridge — measured at 375x667 as "loses 36px", and at 320x568 the
utility row lost 103px.

Fixed by correcting ownership, not by shortening anything: the cradle no
longer clips (`.pc-slot-aperture` already owns the mechanism's clipped
viewport, the only clip ever needed), the bay's physical parts are
`flex:0 0 auto`, and the bay is `min-height:min-content; overflow:visible`
so the already-scrolling `#home` owns the overflow.

### 3. Cabinet height

`.pc-control-bay` was `flex:1 1 auto`, stretching to fill the cabinet and
leaving a dead panel under the utility row. It is now content-sized, the
card is `height:auto` with a 13px floor, and the card is `flex:0 0 auto`
so it cannot shrink below its contents and paint its own floor *above* the
last control on a short phone. Measured floor below the last control:
**35px** at 390px and above, **30px** at 320/375 where the page scrolls.

### 4. The printed event ticket

The dark event drawer is replaced by a printed ticket that feeds out of a
slot beneath the event row. Extracted from the approved Ticket Lab without
reinterpretation. Ordinary HTML and CSS — no canvas, no SVG animation, no
paper simulation, no new artwork.

Printed order: venue and event name; status stamp and table threat; prize
and buy-in; opponent roster; players, stack and format; eligibility or
unlock requirement. The controls are **machine**, mounted on the printer
housing below the paper, never printed on it.

- **Payout is the largest financial value on the ticket.**
- **Opponent names** are the canonical personality from the authoritative
  advertised roster — the same catalogue `newGame()` seats from.
- **The roster is left aligned**: `justify-content:flex-start`, fixed 66px
  seats holding stable 56px portraits, fixed gaps. Never `space-around`,
  `space-evenly` or centred. An incomplete final row begins at the left,
  which is what a four-seat field does at 320px.
- **A locked or otherwise unenterable ticket** gets its stamp, its unlock
  requirement printed prominently, and a **34px quiet status strip** — not
  a large dead key dominating the ticket.
- **Entry paid** carries the punched hole, exactly one `ENTRY PAID` stamp,
  the full event and opponent information, and `CONTINUE` as the primary
  control with `ABANDON EVENT` as the quieter destructive one.

**Prestige** is derived from the venue and changes **material only** —
paper stock, perforation, keyline, seal and serial. Every tier prints the
same terms, in the same places, at the same size: basic (Back Room),
standard (Pub Circuit), premium (Card Club), luxury (Casino Floor and
above). All four are visible in the Lab even though the later venues are
not implemented.

### 5. Print motion and sound

The sequence — mechanism engages, slot opens, paper feeds down in short
stepped movement, overshoots, settles — is armed by **one thing only**:
the tap that opens an event. Instrumented live:

| | prints / sounds |
|---|---|
| page load, arriving at the Career screen | 0 / 0 |
| explicit tap | 1 / 1 |
| re-render, palette change, save write, returning to the screen, resize, closing | 1 / 1 |
| a second explicit tap | 2 / 2 |

Reduced motion reveals the ticket immediately with no travel. **Sound is
deliberately independent of it** — a player who turned motion off has not
turned sound off.

**B — MECHANICAL TICKET is the approved production voice**: a firm
engagement click, a chunky ratcheting feed over a subtle motor, and a
substantial final locking clunk. All three voices (Receipt, Mechanical,
Premium) remain auditionable in the Lab. They are procedural, scheduled on
the AudioContext clock inside the ~0.55s print window so nothing can still
be sounding after the ticket stops, and they inherit every existing rule:
muted creates **no AudioContext at all**, nothing sounds on page load, and
`Sound.unlock()` runs inside the tap so iOS permits audio. `noise()` gained
an optional `when` offset — additive, and every pre-existing caller behaves
exactly as before.

### 6. Venue and palette boundary — unchanged and still enforced

The ticket's mount and keys are **house-fixed**, like every other control
in the directory, and do not follow the machine palette. The paper is
neutral by construction in all four palettes; only the venue heading
carries a venue's authored identity. The committed boundary check now also
requires the paper's own `--tk-*` values to be literals, so a paper colour
can never start resolving through a themed token.

### 7. Legacy active-roster fallback

An event entered before rosters existed carries no `career.active.roster`.
The ticket now reads the seated players back out of the resumable Career
table save, so such an event advertises the opponents it will actually
resume with. Reads only; writes nothing. A table save that does not
describe the event exactly is refused rather than half-used.

### Files changed

- `index.html` — home control bay; Custom Game screen.
- `js/02-support-systems.js` — `gameType` / `runOpponents` settings and
  their migration; `Sound.ticketPrint()` and the three voices; `noise()`
  scheduling; build version.
- `js/04-modes-and-scoring.js` — `careerSeatName()`.
- `js/07-ui-wiring.js` — featured-button state; Custom Game resume and
  game-type dispatch; venue tiers and ticket serial; the printed ticket;
  the print-once flag; the legacy roster fallback.
- `js/08-dev-mode.js` — the rewired menu and Custom Game bindings.
- `css/03-action-console.css`, `css/04-overlays-and-modes.css`,
  `css/06-machine-system.css` — route slab, clipping and cabinet height,
  the ticket and its prestige tiers.
- `sw.js` — cache name.
- `ticket-lab.html`, `css/ticket-lab.css`, `js/ticket-lab.js` — the Lab,
  which now renders the **production** ticket classes and stylesheet, so
  it cannot drift from what ships.
- `validation/career-events-checks.js`, `docs/career/*` — checks and
  handoff.

### Tests

`node validation/career-events-checks.js` — **87 passed** (62 from before
the roster pass, 18 added there, 7 added here: printed term order,
prestige, the quiet locked strip, roster alignment, print arming, the
production sound contract, and the legacy table-save fallback).
`node validation/career-result-checks.js` — **39 passed**, unchanged.
`node validation/scoring-checks.js` — **170 passed**, unchanged.
`node validation/scoring-audit.js` — exit 0, unchanged.

**Production-isolation audit:** no Lab file is referenced by `index.html`
or `sw.js`; the Ticket Lab loads exactly two scripts —
`js/02-support-systems.js` (the real Sound module, so the audition
auditions what ships) and itself — and a committed check fails if it ever
references `careerRosterFor`, `enterCareerEvent`, `settleCareerEvent`,
`saveCareer`, `felt.career` or `localStorage`.

### Rendered verification

320 / 375 / 390 / 393 / 430 across all four palettes: no horizontal
overflow, the whole ticket and its controls reachable by scrolling,
canonical names on one line at every field size, portraits stable at 56px,
incomplete rows left aligned, one ticket open at a time, zero console
errors. Live: entry charges once, resume takes no second charge, and the
advertised opponents are the opponents seated — including for an active
event whose stored roster was deliberately deleted.

**Still outstanding:** on-device iPhone verification, and final sound
approval on a real device.

## Owner-directed pass — Career directory refinement and roster integrity (2026-08-27)

Shipped as `cbaf082`. Build `v0.24.0-dev · Roster Integrity`, service-worker
cache `poker-v23-0` — the cache bump is what delivers this to installed PWAs.

Shipped outside the numeric phase order at the owner's direction. It does not
start Phase 5, does not renumber anything, and changes no economy, pacing,
unlock rule, poker rule or scoring behaviour. Four goals: clarify the
**PLAYER INSTRUMENT → VENUES → EVENTS** hierarchy, simplify the event names,
cut the border noise, and make the advertised table the played table.

### 1. Roster integrity — the headline fix

**The defect.** The directory preview and the table were two independent random
draws that had never been connected:

- the preview built portraits from a seat-index colour formula,
  `(i * 3 + playerCount) % FACE_COLORS.length` — no personalities, and the same
  four colours for a given event forever;
- `newGame()` separately called `pickPersonalities()` and `assignFaceColors()`,
  both shuffled, at the moment of launch.

Measured on the pre-pass build, PUB CIRCUIT OPEN advertised faces `[5,0,3,6]` on
every single visit and dealt `[6,3,5,7]`, `[3,2,7,6]`, `[6,2,0,5]` on three
consecutive entries. The advertised table was **never** the played table.

**The fix — one authoritative roster per event instance.**

- A roster is a minimal anonymous field: `personalityKey` + `faceColorIdx` per
  seat. No names, no dialogue, no familiarity, no history. Phase 7 is untouched.
- It is **drawn once** by the real production paths — `pickPersonalities()` and
  `assignFaceColors()`, reused rather than reimplemented — so a Career field
  comes from exactly the distribution a Single Player table does.
- `career.rosters` holds the field currently **advertised** for each event.
  `career.active.roster` holds the field actually **seated**, captured at entry
  exactly as buy-in and payouts already are, and released from the book so the
  directory draws fresh next time.
- It drives the preview portraits, `newGame()` (via a new optional
  `opts.roster`), the active save and the resume. A settled or abandoned event
  retires its field.
- `normalizeCareerRoster()` rejects any stored field that no longer describes
  its event — wrong seat count, unknown personality key, out-of-range or
  duplicated colour — and redraws rather than half-building a table.
- Every non-Career caller passes no roster and keeps the original random draw,
  bit for bit.

**No save-version bump.** `isValidCareer()` deliberately does not require the
new fields, so a stored v4 career without them is still a valid v4 career and
simply draws its fields on the next visit. A malformed book is discarded, never
rejected. Verified: a fully valid v4 save loads with **zero** writes.

**The one write, and where it is not.** Fields are materialised in
`showCareerScreen()` — once per *visit* — and persisted only if the book
actually changed. `renderCareerScreen()` still writes nothing, so the existing
guarantee that **opening a tray performs no save** is intact and still asserted.

### 2. Event names — display only

| id (unchanged) | was | title now | record name now |
|---|---|---|---|
| `back-room-freezeout` | BACK ROOM FREEZEOUT | `3-HAND` | `BACK ROOM 3-HAND` |
| `pub-freezeout` | PUB CIRCUIT FREEZEOUT | `4-HAND` | `PUB CIRCUIT 4-HAND` |
| `pub-open` | PUB CIRCUIT OPEN | `5-HAND` | `PUB CIRCUIT 5-HAND` |
| `second-chance` | SECOND CHANCE | `SECOND CHANCE` | `SECOND CHANCE` |

Records of earlier milestones further down this file deliberately keep the
titles that were current when they were written; only the ids are stable across
both, and the ids never changed.

`title` is what the directory prints, where the venue marker is already above
it. `name` stays venue-qualified for saves, settled results and the unlock copy
("UNLOCKS BY WINNING BACK ROOM 3-HAND"), because "4-HAND" alone does not say
where. All four still report `FORMAT  FREEZEOUT` — which is precisely why
"Open" could not remain a title. Save ids are untouched. See
`CAREER_DESIGN.md`, *Event naming*.

### 3. Hierarchy and frame reduction

- **`#career` no longer sits in the shared themed cabinet.** That wrapper was
  the outermost redundant frame: it made every venue read as a small box nested
  inside the player's dashboard, and tinted all six with the machine palette.
  `.cpi` now carries the cabinet — rim, drop and all — and is the only framed
  machine on the screen.
- `.cdir` stopped being a cabinet and became a transparent full-width column.
- Each venue is now **one** housing with its marker band as the top of that
  housing, rather than a plate plus a separately framed bay.
- Collapsed events are a single-row plaque: title, printed gold entry price,
  state flag. The entry price lost its own recessed window — a fixed figure is
  printed ink; recessed glass is reserved for information that changes.
- The tray keeps one housing. Inside it the four term cabinets and their four
  wells became **one** recessed CRT strip with internal dividers; the faces lost
  their extra bay; threat became an inline readout; payout kept its window but
  lost its outer panel; the availability note became printed text; the action
  cradle became a recessed seat so the key is the single framed object.

Measured, at 390px, counting elements drawing a complete rectangular outline
inside `#career`:

| tray state | before | after | removed |
|---|---:|---:|---:|
| 3-HAND open | 65 | 34 | 31 (48%) |
| 4-HAND open | 67 | 36 | 31 (46%) |
| 5-HAND open | 68 | 37 | 31 (46%) |
| **total** | **200** | **107** | **93 (47%)** |

Comfortably past the one-third target. Everything physical stayed physical:
venue housings, plaques, portrait windows, flags, CRT surfaces and the action
key all keep their frames and depth.

Also measured at 390px: venue width **296px → 366px**, portraits **40px →
62px**, collapsed row height **58px → 46px**.

### 4. Machine theme vs venue identity

The separation is now **explicit and enforced**, not incidental. Every
declaration below `/* ---- 2. HOUSE DIRECTORY` resolves to an `--h-*` value
scoped to `.cdir` or to a literal; `--font-hdr` and `--radius` (typography and
geometry, not palette) are the only global tokens allowed through. A committed
check parses the stylesheet and fails on any `--theme-*`, `--pc-*`, `--accent*`,
`--felt*`, `--panel*`, `--bg-*`, `--ink-*`, `--card-*` or `--danger` reference in
that block, and on `#career .lobby-card` reappearing in the shared cabinet rule.

Measured across all four themes: **4 distinct player-instrument colours, 1
identical venue fingerprint** (all six venues' band and body colours hashed).

### 5. One small pre-existing defect fixed in passing

At 320px the "EVENTS PLAYED" label wraps to two lines and pushed its own readout
5px below the other two. Present on the pre-pass build too. One declaration —
`align-items:end` on `.cpi-stats`. No other dashboard change.

### Files changed

- `js/04-modes-and-scoring.js` — `title` on each descriptor, `name` requalified,
  `careerEventTitle()`, `generateCareerRoster()`, `normalizeCareerRoster()`.
- `js/05-game-engine.js` — `careerLaunchRoster()`; `newGame()` accepts and seats
  `opts.roster`.
- `js/07-ui-wiring.js` — the roster book (`careerRosterStore/For/release`,
  `materializeCareerRosters`, `careerActiveRoster`, `withCareerRoster`), entry /
  settlement / migration wiring, and the directory markup.
- `css/06-machine-system.css` — `#career` removed from the shared cabinet;
  the Career-screen, player-instrument and house-directory blocks.
- `validation/career-events-checks.js` — 14 new checks; the real opponent
  systems and the real `newGame()` are now loaded into the harness.
- `docs/career/CAREER_DESIGN.md`, `docs/career/BUILD_PLAN.md` — naming decision
  recorded; the Phase 7 roster-authority code question answered.

**Nothing else was touched.** No table, gameplay, dashboard, settings or result
code; no poker rule, hand evaluation or AI behaviour; no economy, payout, stack,
blind structure, unlock rule, Second Chance threshold, counter or save version.

### Tests

`node validation/career-events-checks.js` — **76 passed** (62 pre-existing, with
the four descriptor fixtures and the unlock-copy assertion updated to the
shipped names, and the five launch-terms assertions now comparing terms and
roster separately; 14 new). The harness now loads the real `shuffle`,
`FACE_COLORS`, `assignFaceColors`, `PERSONALITIES_ALL`, `pickPersonalities` and
`newGame`, so roster behaviour is asserted against production rather than a stub.

`node validation/career-result-checks.js` — **39 passed**, unchanged.
`node validation/scoring-checks.js` — **170 passed**, unchanged.
`node validation/scoring-audit.js` — exit 0, unchanged.

### Rendered verification (headless Chrome over HTTP, CDP device emulation)

Chrome clamps `--window-size` on macOS, so viewports were set through
`Emulation.setDeviceMetricsOverride` and the HTTP cache was disabled for every
navigation.

**28 layout cases, all clean** — no document, screen, directory or tray
overflow; nothing outside the viewport; every button ≥ 44px; at most one tray
open; zero console errors. Widths **320 / 390 / 430** across: fresh $500; each
of 3-HAND, 4-HAND, 5-HAND and SECOND CHANCE expanded; an unaffordable event; a
locked event; an active event; and a `$123,456,789` bankroll. Themes
**emerald / midnight / burgundy / slate** at 390px.

**Live walkthrough in the real app**, driving real taps:

- advertised roster → close tray → reopen → **identical**;
- TAKE SEAT → `game.players` **exactly** the advertised personalities and face
  colours; the same field in `career.active.roster`;
- full page reload → resume → **same field again**, bankroll not re-charged;
- two cassettes tapped in sequence → still exactly one tray open;
- settlement → the field is retired and a fresh one drawn;
- Second Chance renders at $40 and $99 and **not at all** at $100 or $500;
- four `LOCKED · COMING SOON` compartments, inventing no event.

**Still outstanding:** on-device iPhone verification, as before.

## Owner-directed milestone — Career event directory (2026-08-25)

Shipped outside the numeric phase order at the owner's direction, after Phase 2.
It does not start Phase 5 and it does not renumber anything; see `BUILD_PLAN.md`.

**What shipped**

- The Career screen is now a physical **event directory**. One cabinet holds two
  visibly separate machines: a personalised **player instrument** above a
  fixed-house scrolling **directory**.
- Player instrument: the stored player name on an inset plate (escaped, falling
  back to `PLAYER`), the bankroll as one `$` cell plus **seven fixed
  whole-dollar digit cells** with the existing dim treatment on leading zeroes
  (`$500` → `$0000500`), and three readouts — highest access, events played,
  events won. A bankroll past seven digits keeps every digit; the cells narrow
  rather than truncating the figure.
- Directory: six room bays in ladder order. Back Room and Pub Circuit hold real
  cassettes from `CAREER_EVENT_LIST`; Card Club, Casino Floor, High Roller Room
  and Invitational Championship show one `LOCKED · COMING SOON` compartment door
  and **no invented descriptor, payout, unlock rule or opponent**.
- Within a room the cheapest event sorts first, so Second Chance leads the Back
  Room when the existing shared predicate exposes it.
- A cassette carries only its name, its entry price and any required flag.
  Selecting one extends a tray whose **real layout height** pushes later events
  down; one tray is open at a time and opening one **writes nothing** — no
  debit, unlock, counter, save or table state.
- The tray shows the opponent lineup through the production `renderFace()` path,
  `TABLE THREAT: MODERATE` / `SERIOUS` from the real `difficulty`, entry,
  players, stack, format, payout, the requirement, and the action.
- Locked and unaffordable events stay inspectable with their action disabled.
- `TAKE SEAT`, `CONTINUE` and `ABANDON EVENT` call the existing
  `careerEnterPressed()` / `careerAbandonPressed()` paths. No parallel entry,
  debit, settlement, unlock, save or result logic was created.
- **Palette boundary:** the player instrument uses the selected production
  palette and recolours with it; the directory declares fixed house values
  scoped to its own root and does not. Verified in `emerald` and `burgundy`.
- The compact last-result summary is retained as an optional state on the player
  instrument.

**Save schema v4**

`felt.career` gains exactly two non-negative integer fields, `eventsPlayed` and
`eventsWon`. Nothing else changed.

| Stored save | Result |
|---|---|
| v3 | bankroll, active event, unlocks and `lastResult` preserved verbatim; both counters initialise to `0`; migration persists once through the normal save path |
| v1 / v2 | every existing v1/v2 guarantee is unchanged and now lands on v4 with counters at `0` |
| any counter that is negative, fractional, non-finite, unsafe or absent | normalised to `0` by `normalizeCareerCounter()` |

A total is **never** inferred from `lastResult`, unlocks or lifetime statistics.
An active event remains resumable across the migration without a second charge.

**Counter semantics**

- `eventsPlayed` increments exactly once inside `enterCareerEvent()`, in the same
  `saveCareer()` that establishes the active event and debits the buy-in, so it
  cannot desynchronise from either. Free Second Chance entry counts. A rejected
  entry — unaffordable, locked, ineligible, blocked by an active event, or an
  unknown id — returns before the increment. Resuming and reloading do not count.
- `eventsWon` increments exactly once inside `settleCareerEvent()`, under the
  same `career.active` guard that owns the unlock write, and only when the
  settlement is a genuine first place. A non-winning cash, a bust and a forfeit
  do not. A repeated settlement call is refused by the guard and cannot
  increment twice. Second Chance first place counts.

These are **aggregates only**. No event history, venue record, head-to-head
record, dossier, title, XP, level or currency was added; those remain Phase 13.

**Tests**

`node validation/career-events-checks.js` — **62 passed** (42 pre-existing, with
the markup-contract and payout-copy assertions updated to the shipped
presentation and fixtures moved to v4; 20 new, covering v4 defaults, v3→v4
migration, v1/v2 migration through v4, an active event resumable across
migration, counter normalisation across every unsafe value, paid entry, free
entry, four rejected-entry paths, reload/resume, first-place settlement,
duplicate settlement, cash/bust/forfeit, a full entry–settle cycle, highest
access, the six rooms inventing no catalogue entry, free-first ordering, threat
wording, requirement copy, the renderer reading live state, and production not
loading the Lab).

`node validation/career-result-checks.js` — **39 passed**, unchanged.

**Manual verification (headless Chrome over HTTP, device-emulated)**

13 cases, all clean — no horizontal overflow, no clipped or wrapped text, every
visible control ≥ 44px, one tray open maximum, zero opponent portraits in the
document while closed, **zero console errors**, and no save write from opening a
tray: fresh $500; recovery at $40 with Second Chance visible; Back Room open;
locked Pub open and inspectable; unaffordable Pub open; active paid event; active
Second Chance; after a first-place win; `$123,456,789` bankroll; `emerald` and
`burgundy`; 393×852, 389×844 and 1280×900; and a stored **v3** save with an
active event, reloaded, migrated and still resumable.

**Still outstanding:** on-device iPhone verification, as before.

**The Career Lab (`career-lab.html`, `css/career-lab.css`, `js/career-lab.js`) is
committed as the durable visual reference.** It is not linked from `index.html`
and is not in the service-worker app shell.

## Phase 3 — Scoring specification and audit — COMPLETE (2026-08-26)

Diagnostic only. **No production behaviour, save, statistic, version, service
worker or Lab file was changed.** Both existing suites pass unchanged.

**What shipped**

- **`docs/scoring/SCORING_SPEC.md`** — the authoritative long-term scoring
  reference, covering Career *and* Single Player: the award table (name, exact
  trigger, value, presentation timing, persistence, mode), the four-category
  commentary catalogue, the hidden-information rule, the lifetime-statistic
  definitions and their on-screen copy, the terminal-hand responsibility split,
  the fixture determinism contract, the audit findings, and the persistence
  disclosure. `CAREER_DESIGN.md`'s *Scoring integrity* section now points to it.
- **`validation/fixtures/scoring-fixtures.js`** and
  **`validation/fixtures/scoring-fixtures-cases.js`** — 26 deterministic
  fixtures. Expected values are DERIVED from the spec's constants, not typed, so
  retuning `BIG_WIN_BB` / `MASSIVE_WIN_BB` at Phase 4B keeps the matrix coherent.
- **`validation/scoring-audit.js`** — the diagnostic harness. It runs the real
  evaluator in a VM over the real production sources and REPORTS current against
  required. **It asserts no correctness**, so no committed check fails and no
  passing assertion preserves a defect. Phase 4 adds `validation/scoring-checks.js`,
  which asserts the same `expected` blocks gate by gate.

**Result: 26 fixtures, 115 compared channels, 77 divergences.** Byte-identical
across consecutive runs. Exit 0 with divergences; exit 1 on a malformed fixture
(verified by deliberately violating the board-length rule).

**Both reported failures reproduce, and one is worse than reported**

- **Failure A (F12)** — a correct-price call loses, the player busts, `GOOD CALL`
  **+100** is presented full-screen, and only then does `RUN OVER` appear.
- **Failure B (F9)** — a hand the player is **$700 down** on fires `MASSIVE POT`
  **+500**, `MONSTER HAND` **+200**, `GOOD CALL` **+100**, a `FILTHY` luck tag,
  and the full pot-smash ceremony. **800 points and a victory ceremony for a
  $700 loss** — three awards, not the one reported.

**Defects measured rather than asserted**

- **K.O. never fires in Career** — the real `resolveEliminations()` returns
  `koCount 0` because Career has no `g.run`.
- **Career prints `TABLE CLEARED`** as an award name before `EVENT WON`.
- **Pot awards are structurally dead on fold-wins** — a genuine +20bb fold-win
  produces no pot award at all.
- **Hidden-card leak in luck tags** — two fixture variants differing in *nothing
  the player can see* (same board, same hole cards, same actions, same
  settlement; only folded opponents' cards differ) emit `luck:lucky` and
  `luck:filthy`.
- **Hidden-card leak in the review panel** — `foldSnapshotNote()` describes a
  fold-win winner's never-shown hand.
- **`stats.biggestPot` records the whole table pot** — 2,030 on a hand netting
  +30 — and **`run.biggestPotWon` counts returned own money** — 1,120 including
  an 880 uncalled return.
- **Score mutation is coupled to presentation** in both paths, so suppressing
  presentation would also suppress score. This is why the specification separates
  detection, mutation, presentation and persistence explicitly.
- **`computePots()` discards `payers.length`** — three layers in one hand
  ($30 from 3 contributors, $20 from 2, $1,980 from 1) all expose `eligible = 1`.

**The lifetime-statistics question, answered**

Career persists **no** score anywhere: a full Career evaluation leaves
`felt.arcade` byte-identical, so Event Score is genuinely ephemeral exactly as
`CAREER_DESIGN.md` claims.

Single Player's permanent profile **is** contaminated and cannot be repaired.
`noteArcadeDiscovery()` writes for every award produced, and
`finalizeArcadeRun()` banks the run total *after* the bust hand's awards — a
`GOOD CALL` awarded on the hand that ended the run reaches
`felt.arcade.highScore` permanently. Affected: `felt.stats.won`,
`showdownsWon`, `biggestPot`, and `felt.arcade`'s `highScore`, `counts`,
`discovered`, `bestByEvent`. **Decision: leave and disclose.** The values cannot
be recomputed and resetting would destroy legitimate history. No stored history
is changed by Phase 4.

**Tests**

`node validation/career-events-checks.js` — **62 passed**, unchanged.
`node validation/career-result-checks.js` — **39 passed**, unchanged.
`node validation/scoring-audit.js` — exit 0, 77 divergences, deterministic.

**Blocking:** the six owner decisions in `SCORING_SPEC.md` section 9.

## Phase 4 — Scoring correction — COMPLETE (2026-08-26)

Ran as four sequential gates. All three validation suites were run after each,
and no gate proceeded on a failure. **No stored statistic, save or Lab file was
changed. The release commit advances only the visible build identifier and
service-worker cache so installed PWAs receive the correction. No poker rule,
hand evaluation or AI behaviour was touched.**

### The six owner decisions, settled 2026-08-26

Each on its recommendation, and recorded as approved in
`docs/scoring/SCORING_SPEC.md` section 9:

1. **Career Event Score kept** — ephemeral, display-only, per-event, never
   persisted, gates nothing. Not XP.
2. **`BIG WIN` renamed and redefined on net profit**, keeping both the flat
   points and the tier escalation. `MONSTER HAND` still scores, under its two
   gates. The thresholds are frozen at 12bb / 30bb.
3. **Section 5.1 lifetime-statistic definitions adopted**; a `ties` counter
   deferred; `DEFAULT_STATS` unchanged.
4. **The `#banner` CRT line is the commentary surface**, with the Hand Review
   panel as expanded analysis.
5. **Decision-quality commentary deferred entirely** to the separate
   range-model workstream. Nothing is scaffolded for it.
6. **`MONSTER BLUFF`, `GREAT BLUFF`, `GOOD BLUFF`, `HERO CALL` and `PUNISH`
   removed.**

### 4A — pot attribution and lifetime statistics

- `arcadeContestedPot()` deleted; `arcadeNetProfit()` replaces it. Every
  win-size award is measured against the player's own net result for the hand.
  This is what stops a hand the player finished **$700 down** from firing
  `MASSIVE POT`, `MONSTER HAND` and a full victory ceremony, and it is also what
  lets a genuine fold-win score at all (the old measure excluded every folded
  contributor, so a +20bb fold-win measured as zero).
- `BIG POT`/`MASSIVE POT` → **`BIG WIN`/`MASSIVE WIN`**, one shared family, both
  gated on `netProfit > 0`.
- **K.O. now fires in Career.** Attribution in `resolveEliminations()` is
  mode-blind; the run counters stay gated on `g.run`, so Career writes no
  Single Player run state.
- **Career awards `EVENT WON`**, never the literal name `TABLE CLEARED`.
- `HERO CALL` and `PUNISH` removed — both read cards or personality the player
  never sees.
- **Lifetime statistics have one writer.** `recordPot()` is gone;
  `recordHandStatistics()` runs once per hand in `finishHand()`, after the
  payout, from the settled net result. `won`, `showdownsWon` and `biggestPot`
  now mean *the player finished the hand ahead* — an exact chop is not a win,
  and a net-losing side-pot share is not a win. `run.biggestPotWon` and
  `tableBiggestPotWon` record net profit, not the gross share.
- Player-facing copy shipped in the same gate: **`Best pot` → `Best hand win`**
  (stat strip and settings statistics), **`Biggest pot` → `Biggest net win`**
  (TABLE CLEARED and RUN OVER recaps), plus the two `career-result-checks.js`
  assertions that pin them. Those two assertions changed **because the approved
  copy changed**, and each is now paired with an assertion that the old label is
  gone.

### 4B — decision awards removed from scoring and presentation

- The entire decision catalogue is **deleted, not disabled** — no flag, no
  scaffolding. `evaluateArcadeSkill()`, `findArcadeFoldBluff()`,
  `isMonsterBluff()`, `heroCatAtSnapshot()`, `actionWasCalled()`,
  `ARCADE_NEGATIVE` and `evaluateArcadeNegative()` are gone.
- Seven objective awards remain: `POT WINNINGS`, `BIG WIN`, `MONSTER HAND`,
  `DOUBLE UP`, `K.O.`, `MASSIVE WIN`, and `TABLE CLEARED` / `EVENT WON`.
- `captureArcadeDecision()` no longer requests decision-time equity, which also
  takes the invalid model's per-decision worker traffic out of the live game.
  The snapshots stay — `classifyArcadeLuck()` reads their sizing.
- The Scoring Guide, the awards glossary, the DEV panel and the DEV pot-smash
  fixtures follow the objective catalogue. **The Scoring Guide now opens with
  the canonical description of the counter, verbatim.**

### 4C — terminal-hand calculation and presentation ordering

- `resolveArcadeHandLate()` split into `resolveArcadeHandScore()` (detect and
  record, silent) plus either `bankArcadeResolution()` (terminal: add the
  points, set `displayedScore` equal, show nothing) or the unchanged
  `presentArcadeResolution()`. Score mutation used to live *inside*
  presentation on both paths, so suppressing the celebration would also have
  suppressed the points.
- **`finishHand()` computes `terminal` before the late pass** and passes it in.
  A hand that busts the player no longer presents a celebratory award between
  the bust and `RUN OVER`.
- A hand that earned nothing no longer opens the reward layer at all: the chips
  are still paid, through the ordinary payout path.

### 4D — objective commentary and the hidden-information rule

- `computePots()` gained the additive `contributors` field. `eligible` is
  untouched and every existing caller is unaffected.
- **Luck tags are gated to showdown-revealed opponents only.** Two hands
  identical in everything visible used to emit `LUCKY` and `FILTHY` purely
  because the *folded* opponents held different cards.
- **The review panel no longer describes a never-shown winning hand.**
  `foldSnapshotNote()` takes an explicit `shown` argument and is not called on a
  fold-win; the fold-win review states the public fact instead.
- One objective commentary line per hand, chosen by a fixed priority ladder,
  delivered to the `#banner` CRT line at the `Hand complete.` beat. Soft lines
  are rate limited to one every four hands; hard settlement facts are exempt.
  All text comes from one lookup, `commentaryLine(id, context)`.
- `presentArcadeCommentary()` deleted — the reward layer is scoring awards only.

### Tests

`node validation/career-events-checks.js` — **62 passed**, unchanged.
`node validation/career-result-checks.js` — **39 passed** (two copy assertions
updated to the approved copy, each paired with a new assertion that the old
label is gone).
`node validation/scoring-checks.js` — **170 passed** (new; asserts the fixtures
gate by gate).
`node validation/scoring-audit.js` — exit 0, **115 channels, 0 divergences**
(was 77), byte-identical across consecutive runs.

Three audit *measurements* were corrected alongside the code, because each had
hard-coded or stood in for a quantity the correction changed and would otherwise
have kept reporting a fixed defect as present. The VM harness both scoring files
share was extracted to `validation/fixtures/scoring-harness.js`, so the report
and the assertions cannot drive the evaluator differently.

### Not done, deliberately

- **No stored history changed.** `felt.stats` and `felt.arcade` keep every value
  they hold, including counts for awards this phase removed. They cannot be
  recomputed and resetting would destroy legitimate history.
- No range model, no decision advice, no scaffolding for either.
- No seeded RNG (D16) — the fixtures are deterministic by construction.
- D4 (only the highest-edge call candidate is tested) not repaired: it tuned a
  verdict that no longer ships.
- `js/result-stage-lab.js` and `js/design-lab.js` still carry the old
  `Biggest pot` / `Best pot` copy in their own fixture data. They are visual
  references outside the specification's enumerated sites and were left
  untouched; **they are now one revision behind the production recaps.**
- CSS for the deleted commentary presentation is now unmatched and was left in
  place rather than risk disturbing a selector still in use.

### Not verified

Rendered/on-device verification of the corrected scoring presentation. See
**Manual checks still outstanding** below.

## Implemented now

- Career is a separate game mode using ordinary freezeout poker and standard AI.
- Persistent save key: `felt.career`, **schema version 4**.
- **Career event directory** presentation (owner-directed milestone, 2026-08-25) — see above.
- **`eventsPlayed` / `eventsWon`** aggregate counters — see above.
- Starting bankroll: $500.
- Data-driven live catalogue with immutable active-event snapshots.
- **Placement-aware payouts.** `payouts` is the canonical reward table (index 0 = first place); `prize` remains as a mirror of `payouts[0]`, an invariant enforced by `isValidCareerEventSnapshot()`. A Top-3 event later is simply `payouts:[a,b,c]` — no further schema work.
- Back Room Freezeout: three players, $100 entry, `payouts:[300]`, 500 stack, Medium AI.
- Pub Circuit Freezeout: four players, $300 entry, `payouts:[1200]`, 750 stack, Hard AI.
- **Pub Circuit Open** (`pub-open`): five players, $300 entry, `payouts:[1050,450]`, 750 stack, Hard AI. Requires a Back Room win.
- Pub Circuit permanently unlocks after a Back Room win — **both** Pub events.
- Only first place can satisfy a venue-unlock requirement. A non-winning cash pays money and grants no status. No event currently requires a win at `pub-open`, so a Pub Open win unlocks nothing today; the generic unlock loop needs no change when Card Club arrives.
- **Placement is measured from the table, never inferred from a win/loss value.** `careerFinishPlace()` (js/05-game-engine.js) counts surviving opponents plus same-hand busted opponents who brought a larger stack to that hand, plus one, clamped to the field. `startNewHand()` records `p._handStartChips` for every player to make that possible.
- Settlement distinguishes first-place win, non-winning cash, non-cashing bust and forfeit.
- `normalizeCareerSettlement()` accepts a placement only as an integer within the paid event's own `playerCount`; anything malformed pays nothing and unlocks nothing.
- Buy-in is deducted and persisted before table launch; the placed prize is credited on top of that deduction.
- Active events can be resumed without a second charge.
- Abandoning an event forfeits the paid buy-in without awarding a prize or unlock.
- Settlement is guarded against duplicate credit and stores bankroll plus cleared active state atomically.
- Career table saves are separate from ordinary Single Player saves.
- Career has its own result presentation and returns to the event screen.
- **Unified result stage (updated 24 August 2026, superseding the earlier chassis-classes
  approach).** `EVENT WON` and `EVENT LOST` are rendered by the SHARED result stage that also
  renders `TABLE CLEARED` and `RUN OVER` — one chassis, one five-region hierarchy, one
  transition. See `docs/ui/handover/CURRENT_STATE.md` for the cross-mode record.
  - `resultStageHTML(model)` (js/05-game-engine.js) builds the chassis; `careerStageModel()`
    supplies the Career variant from the settled display model.
  - `presentResultStage()` is the one production path from "calculated" to "on screen with live
    actions". A win and a bust both reach it; `showCareerEventResult()` guards its early return
    on `model.cashed`, not on `!model.won`.
  - Semantic tone is one custom property, `--stage-tone`: theme rim for a win, coral for a bust.
    In `burgundy` the theme rim is itself the danger coral, so positive results are pinned to the
    approved green there.
  - The headline figure (prize, or forfeited buy-in) is a **mechanical reel** and rolls once.
    Every secondary statistic stays ordinary CRT text.
  - `FINISH`, `EVENT SCORE`, `HANDS`, `FIELD` and the stake/payout cell are the reported values.
    **`FIELD` comes from the event snapshot's `playerCount`**, never from surviving players.
  - `EVENT LOST` never states the buy-in twice: the hero owns the financial result and the recap
    slot reports `PRIZE $0`.
  - The Career progression strip is a deliberate two-part layout (`EVENT COMPLETE` /
    `NEXT: EVENTS BOARD`), with no empty centre value.
  - A **cash** is unchanged: the restrained plain card, titled `EVENT CASHED`, atomic values,
    warm gold edge, no stage roll.
- Quick Resolve is available in the underlying elimination-table flow.
- Version-1 and version-2 Career saves migrate to version 3.
- **Second Chance recovery (Phase 2, 2026-08-25).** Free three-player Medium-AI
  freezeout (`second-chance`), 500 stack, `payouts:[150]`. Visible and
  enterable only while `careerBankroll() < 100` — a fixed value, never derived
  from the cash table or any tournament buy-in. Eligibility is exposed as one
  pure predicate, `isSecondChanceEligible(bankroll)` (`js/04-modes-and-scoring.js`),
  which `careerEventState()` is the only caller of; the Career screen filters
  the board to that state rather than re-testing bankroll itself, so the rule
  exists in exactly one place for the Board to reuse at Phase 5.
  `unlockRequirement` stays `null` permanently — Second Chance can never
  satisfy another event's unlock and nothing can unlock it, so a win credits
  $150 additively and nothing on the status axis moves. Repeatable while
  eligible; the event simply does not render once bankroll reaches $100.
  Entry is revalidated through the same `careerCanEnterEvent()` gate every
  other event uses, so a stale or manually triggered entry at $100+ is
  rejected with no bankroll, active-event, or save mutation. Because the
  active-event branch in `careerEventState()` is checked before the
  eligibility branch, an already-active Second Chance stays resumable even if
  live eligibility were ever read as false while active (bankroll cannot
  actually move mid-active, since nothing else can touch it then). Settlement
  reuses the existing placement-aware machinery verbatim: idempotent credit
  guarded by `career.active` being cleared, second/third place pay $0,
  abandonment forfeits the (zero) buy-in. `venue` reads `BACK ROOM` — Second
  Chance is displayed as a Back Room recovery event, not a distinct venue.
- **Truthful free-event-loss copy, correction pass (2026-08-25).** A loss
  whose captured buy-in is exactly `0` (only Second Chance produces this
  today) no longer claims a buy-in was lost or forfeited on the shared result
  stage. `careerStageModel()` (js/05-game-engine.js) branches on
  `!won && m.buyIn === 0`: the hero reads `BANKROLL CHANGE` / `$0` with an
  empty reel prefix (so `buildResultDigits` can never attach a `+` or `-`
  glyph), and the detail sub-line reads `NO BUY-IN LOST` in place of
  `BUY-IN FORFEITED`. The result statement (`YOU WERE ELIMINATED`) and the
  `EVENT LOST` title are unchanged. Every paid-event loss (`buyIn > 0`) keeps
  its existing `Buy-in lost` / `BUY-IN FORFEITED` copy verbatim — the branch
  is additive, not a rewrite of the existing path. Abandonment never reaches
  this chassis at all (see `careerAbandonPressed()`), so this only affects a
  real bust or non-paying finish at the table.
- **Compact Career-screen result summary signs a zero delta as `$0`**, never
  `+$0` or `-$0` (`renderCareerScreen()`, js/07-ui-wiring.js). A positive or
  negative delta is unaffected and still carries its sign.
- **DEV-only Career bankroll control (manual verification aid, 2026-08-25).**
  The DEV panel accepts a non-negative whole-dollar bankroll value and includes
  `$0`, `$99`, `$100` and `$500` presets so Second Chance can be checked at its
  eligibility boundary without deliberately losing events. It changes only
  `career.bankroll`, persists through the normal Career save, and refreshes the
  Board immediately; unlocks, result history and table saves remain untouched.
  It is disabled while a Career event is active, when the buy-in has already
  been staked, and the mutation function also refuses calls outside DEV mode.
  The Career Board's normal render now refreshes the mounted DEV panel as well,
  so entry locks the control and settlement or abandonment unlocks it without a
  page reload.

## Save migration behaviour

| Stored save | Result |
|---|---|
| v1 winner-take-all active event | rebuilt from the descriptor; recorded `prize` becomes `payouts:[prize]`; paid `buyIn` kept verbatim |
| v1 recorded Back Room win | unlocks every event requiring that win — now both Pub events |
| v2 with no active event | bankroll, unlocks and `lastResult` carried forward |
| v2 active snapshot without `payouts` | rebuilt from the descriptor with the **stored** buy-in and `payouts:[storedPrize]` — never the live catalogue's terms |
| v2 Back Room winner with only `pub-freezeout` unlocked | `applyEquivalentUnlocks()` also unlocks `pub-open` |
| any `lastResult` without `place`/`prize` | normalised to `place:null`, `prize:0`; `outcome`, `delta` and `bankroll` kept verbatim. A placement is never reconstructed from `delta` |

Career **table** saves (`felt.career.table`) follow the same terms rule through `applyPaidCareerTerms()`.

## Two pre-existing defects corrected in this phase

Both were latent and would have surfaced the moment the schema widened:

1. `normalizeActiveCareerEvent()` read paid terms from `active.buyIn`/`active.prize`, fields only **version 1** ever wrote. A version-2 active snapshot failing validation would have been rebuilt from the live descriptor and silently adopted current catalogue terms.
2. `migrateCareer()` copied only unlock ids that already existed, so a player who had already won the Back Room would have found the newly added Pub Circuit Open locked.

## Existing focused checks

- `node validation/career-events-checks.js`
- `node validation/career-result-checks.js`

Run both before and after every Career implementation phase.

Scoring work additionally runs:

- `node validation/scoring-checks.js` — **asserts**; must pass. 170 checks,
  tagged by gate (`--gate 4A` runs one gate's worth).
- `node validation/scoring-audit.js` — **reports** current behaviour against
  `docs/scoring/SCORING_SPEC.md` and counts divergences. Exits 0 even with
  divergences; non-zero only when the harness or a fixture is broken. Currently
  115 channels, **0 divergences**.

Both drive the real evaluator through one shared VM harness,
`validation/fixtures/scoring-harness.js`, so the report and the assertions can
never measure different things.

Last verification on 2026-08-25 (Second Chance correction pass plus DEV bankroll aid): **42/42 event checks and 39/39
result checks passed**.

Event checks: 39 pre-existing (the `venue:'RECOVERY'` descriptor assertion updated to
`venue:'BACK ROOM'`, its only change) plus 2 new — an existing valid version-3 save from before
Second Chance existed (missing `unlocks['second-chance']` only) preserves bankroll, active state,
existing unlocks and last result, adds the new catalogue entry safely, persists the migration, and
leaves eligibility governed solely by live bankroll (checked both with an active event blocking
entry and, separately, at bankroll $40 and $500 with no active event); and the compact Career
result summary rendering `$0` rather than `+$0`/`-$0` for a zero delta, with a real gain and a real
paid loss both proven to still carry their sign.

DEV-aid coverage adds one further check: whole-dollar `$99` and `$100` values persist and drive
the shared Second Chance predicate immediately; invalid, fractional, negative and unsafe values
are rejected; non-DEV calls and changes during an active event are rejected; unlocks and result
history remain byte-for-byte equivalent.

Result checks: 36 pre-existing, unchanged, plus 3 new — a free-event loss (captured buy-in `$0`)
never claims `BUY-IN LOST`, `BUY-IN FORFEITED`, `+$0` or `-$0` (the `BUY-IN LOST` check strips the
truthful `NO BUY-IN LOST` phrase first, so it cannot false-positive against its own required
copy); the same case uses `BANKROLL CHANGE`, a signless `$0` reel and `NO BUY-IN LOST`, with
`EVENT LOST` and `YOU WERE ELIMINATED` unchanged; and an ordinary paid-event loss (`buyIn:100`,
the pre-existing fixture) keeps its exact `Buy-in lost` / `BUY-IN FORFEITED` copy, proving the new
branch is additive.

Last verification on 2026-08-25 (Second Chance, Phase 2 implementation): **39/39 event checks and
36/36 result checks passed** (27 pre-existing — one assertion updated, the registry length from 3
to 4, since Second Chance is a real fourth descriptor; 12 new, covering the descriptor, the
eligibility predicate at every boundary in the exit condition's set ($0/$49/$50/$99/$100/$101),
free entry, additive credit from $0 and from $99, duplicate-settlement rejection, $0 for
second/third, defeat/abandonment leaving unlocks untouched, proof that a win never unlocks Pub
Circuit, an active event's resumability under a hypothetical later-diverging eligibility read, and
non-interference with Back Room/Pub Circuit event states). Result checks were unchanged in that
pass — the implementation touched no result-stage code; this correction pass is what adds result
coverage.

Last verification on 2026-08-24 (unified result stage): **27/27 event checks and 36/36 result
checks passed** (24 pre-existing, updated where the approved decision moved what they assert;
12 new, covering the shared chassis).

Assertions changed because the approved presentation changed, not to suppress a failure:

- `Career result uses no fragmented mechanical amount markup` became
  `EVENT CASHED uses no fragmented mechanical amount markup`. The rule is unchanged for the cash
  card, which still owns it; the four stage results now deliberately carry one mechanical hero
  reel each, asserted separately by `Every outcome has exactly one mechanical hero reel`.
- The model check gained `field`, and the event fixtures gained the `playerCount` they were
  always entered with.
- `Only a non-winning cash skips the stage roll` became
  `Only a non-winning cash skips the shared result stage` and now asserts the shared path.
- The CSS isolation check no longer expects `.stage-results.career-event-result{`: a win and a
  bust ARE the stage rather than a panel mounted on it, so that selector was removed with the
  panel. It asserts the cash card's own placement selector instead.

New coverage: the five-region chassis across all four outcomes, one hero reel each, tone carried
by the model rather than by four treatments, the TABLE CLEARED baseline verbatim, RUN OVER's
hierarchy and personal-best fallback, `FIELD` provenance, no duplicated buy-in on a loss, the
two-part Career strip, exactly one result transition used by all four, per-outcome finalisation
guards, and the DEV tester settling and persisting nothing.

Last verification on 2026-08-23:

- 27/27 focused Career event checks passed (12 pre-existing, updated where the code they assert against moved; 15 new).
- 24/24 focused Career result checks passed (12 pre-existing; 12 new).

New coverage includes the Pub Circuit Open descriptor and five-player launch config, single $300 entry, $1,050 first place, $450 second place, $0 for third through fifth, unlock only from first, malformed-placement rejection, bust and abandonment, resume without recharge, captured-terms settlement, duplicate-settlement prevention, unchanged winner-take-all behaviour, every migration row above, and `careerFinishPlace` in both tie-break directions.

## Not verified

- No on-device verification was performed. The manual checklist below is outstanding.
- Rendered verification of all four result transitions WAS performed in a desktop browser at
  393x852 and 834x1112: all four settle at an identical size and position, no clipping or
  horizontal overflow, actions are inert until the stage locks, reduced motion settles
  immediately with no stuck transition layers, `NEXT TABLE` reaches table 2, a real bust
  finalises exactly once, and `EVENT CASHED` is visually unchanged.

## Not implemented

- Scoring beyond Phase 4. The specification, audit and correction are all
  complete (2026-08-26). What remains unbuilt by explicit decision: the
  action-conditioned range model and any decision-quality commentary, which are
  a separate, separately approved workstream this file does not schedule.
- Contextual Recommended / Alternative / Next-target selection and Full Circuit
  (Phase 5). The event directory shipped in 2026-08-25's owner-directed milestone
  is the presentation that logic will be built into; the six-venue ladder and the
  permanent-access readout already exist there.
- Card Club preview.
- Back Room pacing instrumentation.
- Named residents, roster-as-paid-term, or any relationship record.
- Back Room boss seat or first-clear ceremony.
- The Back Room cash table, cash-session save state, or cash-session recovery.
- Dossiers, career record, milestone titles, trophies, rotation, or cosmetics.
- Satellites, seats, Card Club gameplay, or higher tiers.

## Approved future sequence

Summary only — `BUILD_PLAN.md` is authoritative for scope, exclusions,
dependencies and exit conditions.

| Phase | Work | State |
|---:|---|---|
| 1 | Paid places and Pub Circuit Open | Complete |
| 2 | Second Chance recovery | Complete |
| — | Career event directory (owner-directed, not a phase) | Complete |
| — | Directory refinement + roster integrity (owner-directed, not a phase) | Complete |
| — | Printed tickets + menu consolidation (owner-directed, not a phase) | Complete |
| — | Segmented controls to a 44px target (follow-up, not a phase) | Recorded, not started |
| 3 | Scoring specification and audit | Complete |
| 4 | Scoring correction (gates 4A–4D) | Complete |
| 5 | Contextual Board and visible Full Circuit | **Next** |
| 6 | Back Room pacing instrumentation and decision | Approved, not started |
| 7 | Named residents, roster authority, minimal relationship record | Approved, not started |
| 8 | Back Room boss seat and first-clear ceremony | Approved, not started |
| 9 | Back Room cash table | Approved, not started |
| 10 | Board extension for live cash, boss and field state | Approved, not started |
| 11 | Back Room playtest gate | Approved, not started |
| 12 | Pub Circuit expansion | Approved, not started |
| 13 | Full dossiers, records, titles, controlled rotation | Approved, not started |
| 14 | Trophies | Approved, not started |
| 15 | Cosmetic spending experiment | Approved, not started |
| 16 | Card Club gate, then higher venues one at a time | Approved, not started |

Phases 7–10 are the Back Room vertical slice; Phase 11 tests it. One phase at a
time, in numeric order.

## Follow-up task — segmented controls to a 44px touch target (raised 2026-08-27)

Held back from the printed-ticket pass at the owner's direction. Full
scope in `BUILD_PLAN.md`.

`.segmented` buttons are **36px** tall, under the 44px minimum. Inherited,
not introduced: measured at 12 instances on Classic Table Setup before this
work began. It is a shared component used by Settings as well as Custom
Game, so it needs its own pass with visual regression checks rather than a
quiet edit inside a presentation change.

## Open design issue — the threat ladder (raised 2026-08-27)

Recorded during the printed-ticket integration and **not acted on**, as
directed. Full entry in `CAREER_DESIGN.md`.

> The current threat ladder reaches SERIOUS too early, including near the
> beginning of the Pub Circuit. Threat terminology and AI progression
> require a dedicated Career balance pass so the language communicates a
> steady climb from welcoming introductory tables to genuinely elite
> late-career opposition.

Needs its own Career balance pass. No difficulty, AI or threat label was
changed by the ticket work.

## Side prototype — character chatter (2026-08-28; owner checkpoint 2026-09-02)

The focused visual/audio review is complete. The selected direction is **E1 —
Elastic / Clean**: a boxy cream speaker-owned bubble with a reliable stepped tail
for left, right and centre speakers, live two-/three-character typing, an
explicit two-line/50-character authoring limit, restrained seat/portrait
emphasis, and the shared **Rapid Pixel Chatter** SFX (dense typing-synchronised
ticks ending in a small bloop). E2 Paper-backed remains an alternate reference,
not the winner. All eight focused Lab checks pass. See the retained decision
record in `docs/career/CHATTER_PROTOTYPE.md`.

**The work is now paused.** Character identities, dialogue, memory and emotion
design are not approved. Harry, Tony, Lucy, Nigel and Steve remain fixtures, and
the later characterisation discussion must not be treated as canon when the
work resumes.

**This is not a milestone and changes nothing below.** No Career save, unlock,
roster, scoring or table code was touched; no Phase moved; the Immediate next
task is unchanged. The prototype cast is a fixture and does **not** pre-empt the
Phase 7 roster decision in `CAREER_DESIGN.md`.

## Enemy / Personality Pass — CODE-COMPLETE, awaiting owner sign-off (2026-09-04)

Owner-authorised. The five chatter-prototype residents — Harry, Tony, Lucy,
Nigel and Steve — are now the production cast. This **settles the Phase 7
identity question** in their favour: the paused-fixture wording below and in
`CHATTER_PROTOTYPE.md` is superseded for identity only. Everything else about
Phase 7 (the three relationship counters) remains unbuilt and out of scope.

One canonical registry, `js/03-residents.js`, owns every resident's name,
permanent portrait colour, resting face, expression vocabulary, biography,
public style line, chatter voice and private AI tendency dials. The chatter
prototype's own copy is gone; `js/chatter/01-residents.js` is now an adapter over
the production record. Tables seat the cast first and fill any seat beyond five
with an ordinary archetype **visitor** — a public style label and a minimal
profile, no biography, no continuity — so every existing table size (Custom Game
1–8, run 4/5/6, Career 1–5) is preserved and no resident is ever duplicated.

The residents are measurably different at the table, driven from inside the
existing `aiDecide()` rather than as a cosmetic multiplier. A visitor's profile
is neutral, so ordinary archetype play is unchanged. Fixing this exposed a real
pre-existing bug: `seatsAfter()` counted every live opponent rather than those
still to act, so the positional term — and the whole difficulty
`positionWeight` ladder — evaluated to zero in every ordinary hand. It now uses
the existing `acted` flag.

Two new player-visible surfaces, both rendering from one `dossierModel()`: a
**House Faces** screen reached from the existing main-menu cast drawer (no new
menu button), and a compact dossier opened by tapping a live opponent module at
a presentation-stable reading moment.
Neither exposes a hole card, an equity, a bluff flag or a tendency number; the
mood line comes from `faceMood` only. The keyboard shortcut handler now refuses
to submit a poker action while any menu is open, which also closes a
pre-existing hole where typing `f` with Settings open folded the hand.

**No save schema moved.** Table `SAVE_VERSION` stays 1 (bumping it deletes every
table in progress) and Career stays **v6**. `residentId` is additive. A legacy
table keeps the opponents it was dealt until it ends. `career.active.roster` is a
paid term and is never redrawn; only the unpaid preview book is refreshed, which
costs nothing and touches no money, unlock, counter or statistic.

Build `v0.33.1-dev · Enemy Personalities`, service-worker cache `poker-v33-1`.

Validation at code-completion: **112** Career event checks, **41** Career result
checks, **170** scoring checks, **20** gameplay-format/AI checks, **9** chatter
isolation checks, **10** resident behaviour checks (new), **28** resident
identity and surface checks (new), and **0** scoring-audit divergences.
JavaScript syntax checks pass.

Correction and visual-QA pass: the canonical resident expression maps now drive
the live faces instead of falling through to the shared generic pool; opening a
dossier can no longer hide a card/chip flight and let it finish invisibly; the
whole opponent module is the target, giving every seat a 46×129px hit area even
at an eight-opponent 320px table; closed dossier content is inert and hidden
from assistive technology; and House Faces changes selection in place so
keyboard focus survives. Its selected tile now reads as a depressed machine
control rather than a browser outline.

Rendered QA passed at **390×844** and **320×700** with no horizontal overflow:
House Faces remained aligned, the selected tile retained focus, an eight-
opponent table preserved all target sizes, the live dossier fit with its Close
control visible, close returned focus to the originating seat, and an attempted
open during active AI play was rejected. The focused resident identity suite is
now **28** checks. The complete validation run passes all suites and the scoring
audit remains at **0 divergences**.

**Not committed.** Automated and rendered Codex QA are complete; the owner still
gets the final visual review before the pass is committed.
Full architecture, migration policy and simulation evidence in
`docs/ENEMY_PERSONALITY_PASS.md`.

## Immediate next task

**Rendered verification of the Phase 4 scoring correction**, then
**Phase 5 — Contextual Board and visible Full Circuit.**

Unchanged by the 2026-08-27 owner-directed pass, which touched no scoring code.
That pass's own rendered verification is complete and recorded above; the
outstanding gate below is still Phase 4's, items 15–24.

Phase 4 is code-complete and passes every automated suite, but no part of it has
been seen on a screen. The manual checklist below (items 15–24) is the gate. It
should be walked before Phase 5 starts, because Phase 5's dependency line in
`BUILD_PLAN.md` is explicitly *"nothing is surfaced on top of an untrusted
score"* — and the score is only trustworthy once the corrected presentation has
actually been watched.

Phase 5's scope is unchanged and is defined in `BUILD_PLAN.md`. Do not start it
while the checklist is outstanding.

Phases 3 and 4 are complete — see the records above and
`docs/scoring/SCORING_SPEC.md`, which is the authoritative scoring reference.

On-device iPhone verification of the four result-stage transitions (from the
24 August 2026 `Round End Update`) is still outstanding — see Not verified.
Rendered verification of Second Chance (below) is also still outstanding — see
Manual checks still outstanding.

DEV scoring tester (retained): the DEV panel's ARCADE TEST section now drives the
objective catalogue only — BIG WIN, MONSTER HAND, DOUBLE UP, K.O., MASSIVE WIN,
TABLE CLEARED, EVENT WON — and its COMMENTARY controls paint the real CRT action
line through the same `commentaryLine()` lookup a real hand uses, rather than the
reward layer they used to borrow.

DEV transition tester (retained for future result work): enable Developer Mode in Settings (or load with `?dev`), open the DEV
panel, and use MAJOR RESULT TRANSITIONS. It drives the real `presentResultStage()` path with
fixture state: no buy-in, no prize, no unlock, no save, no lifetime statistic and no high score
is written. Each result action re-arms the tester so a transition can be watched repeatedly;
RESET TESTER returns to the Main Menu.

## Manual checks still outstanding

1. Career screen shows three events; Pub Circuit 5-HAND locked until the Back Room is won.
2. Entering Pub Circuit 5-HAND drops the bankroll by $300 and deals a five-handed table.
3. Refresh mid-event, then Continue Event — resumes without a second charge.
4. Finish 2nd — `EVENT CASHED`, `+$450`, bankroll up $150 net, no new unlock, and **no stage
   roll**: the restrained plain card over the live felt, exactly as before.
5. Finish 1st — the shared result stage, `EVENT WON`, `+$1,050` on the hero reel.
6. Abandon — buy-in forfeited, no prize, no unlock.
7. Back Room 3-HAND and Pub Circuit 4-HAND play and settle exactly as before.
8. Five-handed table layout and the Payout readout are legible on an iPhone.
9. At a bankroll below $100, Second Chance appears as a fourth, free-entry card; at $100 or
   above it does not render at all (not even disabled).
10. Enter Second Chance — bankroll does not move; the table is a three-handed 500-stack Medium
    game.
11. Win Second Chance — bankroll goes up by exactly $150, no new venue unlock appears.
12. Bust Second Chance (finish 2nd or 3rd, or get eliminated) — the shared `EVENT LOST` stage
    reads `BANKROLL CHANGE` / `$0` on the hero (no `+` or `-`), `YOU WERE ELIMINATED` as the
    result statement, and `NO BUY-IN LOST` as the sub-line — never `BUY-IN FORFEITED` or a signed
    `$0`. Bankroll is unchanged; Second Chance remains available on the next visit to the Career
    screen if still under $100.
13. Abandon an active Second Chance — bankroll unchanged, no result card is shown (abandonment
    returns straight to the Career screen), and the compact result summary at the top of that
    screen shows a bare `$0`, never `+$0` or `-$0`.
14. Confirm an ordinary paid loss (e.g. a Back Room bust) still reads `Buy-in lost` on the hero and
   `BUY-IN FORFEITED` on the sub-line, unchanged by this pass.

### Phase 4 — scoring correction (2026-08-26). All outstanding.

Single Player (Arcade elimination run) unless stated. Developer Mode's ARCADE
TEST controls set up several of these without waiting for the hand to occur.

15. **A hand won outright.** The reward breakdown opens with `POT WINNINGS`, the
    pot smash runs, and the SCORE counter rolls once. A win of roughly 12+ big
    blinds adds `BIG WIN`; roughly 30+ adds `MASSIVE WIN` instead — never both.
16. **A hand where you win a side pot but finish DOWN on the hand.** Expect
    **no reward layer, no TOTAL and no pot smash at all** — the chips are still
    paid onto your stack, and the CRT line under the table reads
    `Side pot won. Down on the hand.` This is the headline fix: it used to award
    800 points and run a full victory ceremony.
17. **An exact chop.** No reward layer; the CRT line reads
    `Pot chopped. Stake returned.`
18. **An uncalled shove — you bet big and everyone folds.** The CRT line reads
    `Uncalled bet returned.` A large *matched* fold-win instead reads
    `No showdown. Pot taken.`, and that line appears at most once every four
    hands.
19. **The hand that busts you.** Nothing at all between the last card and
    `RUN OVER` — no award, no sound, no score roll. The final score on the
    result stage is correct and is not still counting up behind it.
20. **The hand that clears the table.** The pot smash for your own payout still
    runs, then straight to `TABLE CLEARED` with no separate K.O. carousel first.
    The K.O. and TABLE CLEARED points ARE included in the score shown.
21. **Career: win an event.** K.O.s now score in Career, and the terminal award
    is `EVENT WON` — the words `TABLE CLEARED` must never appear in a Career
    event. Confirm the Career screen bankroll is unchanged by any of this.
22. **No decision award ever appears.** `GOOD FOLD`, `GOOD CALL`, `HERO CALL`,
    `GOOD PRESSURE`, `MONSTER BLUFF`, `BAD CALL` and the rest are gone from the
    game, from Settings ▸ Help ▸ Scoring Guide, and from the awards glossary.
23. **Settings ▸ Help ▸ Scoring Guide** opens with *"An ephemeral machine tally
    generated by positive chip results and objective milestones. It is not
    profit, skill, XP or Career progression."* and lists only the objective
    awards. The stat strip and Settings statistics read **`Best hand win`**; the
    TABLE CLEARED and RUN OVER recaps read **`Biggest net win`**.
24. **The Hand Review panel on a fold-win you were not part of** must not
    describe the winner's cards. It should say their cards were never shown, and
    nothing more.

For checks 9–14, the DEV panel's **CAREER BANKROLL** control can set `$0`, `$99`, `$100`, `$500`
or any non-negative whole-dollar value. It is intentionally disabled during an active event.

## Working decisions to validate

- Pub Circuit Open uses Hard AI initially.
- Pub Circuit Open's 70/30 split is a prototype value, not an approved universal ratio.
- Simultaneous-bust tie-break: players busting on the same hand are ranked by the stack they brought to it, and an exactly equal starting stack gives the human the better place. Deterministic and player-favourable, but a judgement call rather than a rule the codebase previously encoded.
- `lastResult.delta` keeps its pre-existing convention: the gross prize when one was paid, otherwise the forfeited buy-in — not net profit.
- The board uses a three-buy-in Comfortable threshold.
- Risky entries use an in-place second confirmation rather than a new details screen.
- Second Chance pays $150 and appears below $100 (implemented, Phase 2). Its emotional
  effect and exploitation potential remain unobserved until Phase 11 playtesting.
- Second Chance's `venue` reads `BACK ROOM` (corrected 2026-08-25; briefly `RECOVERY` in the
  initial Phase 2 pass). It does not affect eligibility or progression, both of which read only
  from `isSecondChanceEligible()`/`unlockRequirement`, never from `venue`.
- A free-entry Second Chance loss (bust, or any non-paying finish) settles at `delta:0` and now
  presents truthfully: `BANKROLL CHANGE` / `$0` / `NO BUY-IN LOST` on the shared result stage
  (correction pass, 2026-08-25), rather than a false `Buy-in lost` claim. Abandonment still shows
  no result card at all and settles at `delta:0` on the compact Career summary, which now renders
  that as a bare `$0`.
- Exact upper-tier economy, event durations, and the 4–8-hour career target remain unvalidated.
- Career pacing now has bounded local measurement, but real-session evidence is
  not yet sufficient for a further stack-depth or cadence change.

## Historical "Do not start next" (superseded 2026-09-02)

This section records the pre-Holiday handoff and is no longer current. See the
completed Holiday pass and its immediate next task at the top of this file.

Permanently excluded:

- XP, perks, power-ups, or any additional currency.
- Cash Cut or any roguelite system.

Approved for a later phase — not now:

- The action-conditioned range model and any decision-quality commentary —
  a separate, separately approved workstream, not scheduled by
  `docs/scoring/SCORING_SPEC.md` and not by this file. Scoring **thresholds are
  frozen** and are not retuned before Phase 11's playtest evidence.
- Named-resident expansion, relationship records, or boss seat (Phases 7–8).
- Career history, milestone titles, dossiers, trophies, or cosmetics
  (Phases 13–15). The previous blanket exclusion of career history, titles,
  records and recurring-opponent progression was reversed by the owner on
  2026-08-25; they are now scheduled, not forbidden.
- Additional Card Club events or higher playable tiers (Phase 16).

Still deferred with no owning phase:

- Satellites or seat inventory.
- Full Elite AI work.
- Bot simulation or analytics infrastructure.

## Handoff protocol

At the end of any Career task:

1. Record what changed under Implemented now / Not implemented.
2. Set one concrete Immediate next task.
3. Record tests run and their result.
4. Update the verified commit after the work is committed.
5. Move any changed product decision into `CAREER_DESIGN.md` and explain why.
