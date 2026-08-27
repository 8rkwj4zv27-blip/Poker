# Career Mode — Current Status

Last verified: 2026-08-27
Verified implementation baseline: the **Career directory and roster-integrity
pass** below (uncommitted at the time of writing), on top of `2673dcb` —
`Record the scoring correction commit in Career status`, on top of `4f9a351` —
`Correct scoring attribution and feedback`, on top of `35d93c3` — `Integrate the
Career event directory` (the owner-directed milestone below), on top of
`cb9aee0` — `Career Phase 2: Second Chance recovery, truthful loss messaging,
DEV bankroll tool`. Career logic baseline before Phase 2 was `d31b120` — `Add
multi-place payouts and Pub Circuit Open` (Phase 1).
Build `v0.23.0-dev · Scoring Correction`, service-worker cache `poker-v22-0`.
Career save schema **version 4** — unchanged by the 2026-08-27 pass, which
added the roster book as a tolerant additive field rather than a fifth version.

This is the short handoff file. Update it whenever a Career milestone is completed or the immediate next task changes.

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

## Owner-directed pass — Career directory refinement and roster integrity (2026-08-27)

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
- Career pacing is unmeasured. Back Room instrumentation and the resulting
  stack-depth and blind-cadence decision are Phase 6's job; blinds are not
  accelerated before that measurement exists.

## Do not start next

Rendered verification of the Phase 4 correction is the task in flight; Phase 5 is
next after it. Nothing below is next, whether it is permanently excluded or
approved for a later phase.

Permanently excluded:

- XP, perks, power-ups, or any additional currency.
- Cash Cut or any roguelite system.

Approved for a later phase — not now:

- The action-conditioned range model and any decision-quality commentary —
  a separate, separately approved workstream, not scheduled by
  `docs/scoring/SCORING_SPEC.md` and not by this file. Scoring **thresholds are
  frozen** and are not retuned before Phase 11's playtest evidence.
- Pacing instrumentation or any blind-cadence change (Phase 6).
- Named residents, relationship records, boss seat, or cash table (Phases 7–9).
- Career history, milestone titles, dossiers, trophies, or cosmetics
  (Phases 13–15). The previous blanket exclusion of career history, titles,
  records and recurring-opponent progression was reversed by the owner on
  2026-08-25; they are now scheduled, not forbidden.
- Playable Card Club or upper tiers (Phase 16).

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
