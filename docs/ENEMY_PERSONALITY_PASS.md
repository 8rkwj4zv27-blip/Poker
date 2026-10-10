# The Enemy / Personality Pass

Build `v0.33.1-dev · Enemy Personalities`, service-worker cache `poker-v33-1`.
Table save schema **1** (unchanged). Career save schema **6** (unchanged).

## Why

Opponents were assembled from three unrelated systems that never agreed with
each other: a random first-name generator, eight generic archetypes
(`PERSONALITIES_ALL` — Rock, Shark, Maniac…), and a separately shuffled portrait
colour. The same "Shark" was a different colour and a different name at every
table, so nobody ever recurred and there was nothing for the player to learn.

Five authored residents already existed — Harry, Tony, Lucy, Nigel and Steve —
but only inside the paused chatter prototype, which production never loaded and
which held its own private copy of every name, colour, biography and expression
map.

This pass promotes those five into production as the canonical cast, gives them
materially different poker behaviour driven from inside the existing decision
function, and adds the two surfaces that let a player learn who they are.

## Owner decisions taken for this pass (2026-09-04)

- **Seats beyond five: residents first, then visitors.** Every table seats the
  five residents first, shuffled and unique. Any further seat uses the existing
  generated-name/archetype system as a temporary **visitor** — a unique free
  colour, a public style label, a minimal clickable profile, and no authored
  biography, recurring identity or false continuity. All current table sizes are
  preserved. A resident is never duplicated.
- **The chatter prototype's cast is now production canon.** `CHATTER_PROTOTYPE.md`
  and `STATUS.md` previously recorded the five as paused fixtures that must not
  pre-empt the Phase 7 roster decision. The owner has explicitly authorised
  bringing stable named resident identity forward, which settles that decision in
  their favour. Nothing else about Career moved.

## Architecture

### One canonical registry — `js/03-residents.js`

A dependency-free, DOM-free data module loaded before `js/03-opponents.js`. It is
the single source of truth for resident identity; nothing else in the codebase
may declare a resident's name, colour, biography or expression map, and a check
greps every production file to enforce that.

Each record carries, in clearly separated groups:

| Group | Fields |
|---|---|
| Public identity | `id`, `name`, `faceColorIdx`, `style`, `blurb`, `tendencies[]` |
| Expression vocabulary | `rest`, `moods{}` (semantic role → `FACE_ART` key) |
| Chatter/voice identity | `voice`, `chattiness` |
| Private AI tendencies | `aggression`, `tightness`, `bluffFreq`, `sizing`, `thinkSpeed`, `poker{}` |
| Temperament | `temperament{ moodGain, moodDecay }` |

`residentPersona()` builds the object `aiDecide()` and `makePlayer()` already
consume, keyed `res:<id>` so a resident key can never collide with one of the
eight legacy archetype keys. `personalityByKey()` resolves residents first, then
archetypes, and replaces every scattered
`PERSONALITIES_ALL.some(p => p.key === …)` save-validation predicate.

**Chatter boundary.** `js/chatter/01-residents.js` lost its private cast and is
now a thin adapter that projects the production registry into the existing
`ChatterResidents` API; `chatter-stage.html` loads `js/03-residents.js`. Only the
identity module crosses the boundary — no AI, no engine, no saves — and nothing
in production reads anything from `js/chatter/`. Chatter is still not wired into
`index.html` or `sw.js`, and `bubblesAllowed()` still returns `false`. The
authored line library needed no change: it tags lines with the same semantic mood
roles the canonical record now carries.

### Seating — residents first, then visitors

`pickTableCast(n)` in `js/03-opponents.js` shuffles the five residents, seats
`min(n, 5)` of them, and tops up any remaining seats with `pickPersonalities()`,
which is unchanged. Supported fields:

| Format | Opponents | Composition |
|---|---|---|
| Career events | 1–5 | residents only |
| Single Player run | 4, 5, 6 | one visitor at six |
| Custom Game (cash/tournament) | 1–8 | up to three visitors |

Colour distinctness falls out for free: residents own indices 0/1/3/4/5
permanently, `assignFaceColors()` only backfills seats that have none, and
`FACE_COLORS` has exactly eight entries — so the three possible visitors take
2/6/7 and no table can repeat a colour.

A resident is never shown under an alias. The Opponent Names = Random setting
still governs visitors, whose names carry no continuity and never did.

### Behavioural model

`aiDecide()` was not rewritten. Its existing dials already thread through the
fold gate, the raise gates, the call threshold and the sizing formulas; each
resident gets its own values for those, plus a private `poker` block read at the
same existing decision points:

| Dial | Applied at | Effect |
|---|---|---|
| `entryBias` | preflop `foldGate` | how wide they enter |
| `raiseDrive` | both raise rolls | raise / re-raise propensity |
| `callTolerance` | `callThreshold` | how wide they continue |
| `pressureRespect` | the `betPressure` term of `callThreshold` | respect for large bets |
| `sizing` | `sizeMul` | bet-size fingerprint |
| `drawPersistence` | a capped credit on `perceived` when a real draw exists | draw persistence |
| `trapChance` | unopened postflop, above the value-bet threshold | trapping |
| `positionSensitivity` | multiplies `dp.positionWeight` | position weighting |
| `shortStackDrive` | `foldGateWiden` and the critical-stack jam | short-stack aggression |
| `gearRange` | a per-hand gear seeded from public state | changing gears |

Every dial is a probabilistic preference. Fold, call, raise and check all remain
reachable for every resident in every spot, and `raiseOrSettle()`/`cappedTotal()`
legality guards are untouched. **A visitor's profile is neutral — every
multiplier 1, every offset 0 — so an ordinary archetype takes exactly the
decisions it took before this pass.**

`publicDrawStrength(hand, board)` is new and reads only the AI's own two cards
plus the public board: four-to-a-flush, open-ended and gutshot straight draws,
returning 1 / 0.5 / 0. It is a preference input, never a replacement for equity.

`temperament` scales the existing public-event `nudgeMood()` intensity and the
per-hand decay. Steve rides a run hardest, Lucy barely registers one. Mood stays
subordinate: a seeded check requires the widest and tightest residents to keep
those positions through a mood swing.

### Personality vs difficulty

`DIFFICULTY_PARAMS` still owns exactly its three knobs — `iterations` (simulation
quality), `noise` (decision error) and `positionWeight` (positional accuracy).
Personality never scales the first two. The one meeting point is
`dp.positionWeight * prof.positionSensitivity`, which multiplies rather than
replaces, so a resident stays recognisable at every difficulty and every
difficulty still improves the underlying read.

**A pre-existing bug had to be fixed for that axis to exist at all.**
`seatsAfter()` wrapped the whole table and counted every live opponent — the same
number `aiDecide` already had in `numOpp` — so `dp.positionWeight * (1 -
seatsAfter/numOpp)` evaluated to zero in every ordinary hand. The difficulty
ladder's rising `positionWeight` (0.00 → 0.14 across easy → elite) had been
silently doing nothing. It now counts only live opponents who have **not yet
acted**, using the existing, maintained `acted` flag. Its own comment always
claimed this ("late position — few players left to act"); the code did not do it.

### Mood and tells

The `moodState` / `faceMood` split is unchanged, including the deliberately
mismatched field names (`kind` vs `family`). No write site moved. Checks assert
there is no path from `faceMood` into `aiDecide`, and that no dossier or face
path reads a hand, an equity, a bluff flag or a private dial.

### Persistence and migration

**Table save — `SAVE_VERSION` stays 1.** `isValidTableSave()` deletes any save
whose version differs, so bumping it would throw away every table in progress.
Every new field is additive.

- `serializeTable()` writes `residentId` alongside the existing `personalityKey`.
- `restoreTable()` resolves `residentId` → `personalityKey` → null. A resident's
  name and colour come from the registry, never from the snapshot, so a stale or
  hand-edited save cannot rename or recolour one.
- **Legacy saves** (no `residentId`, archetype key) load safely and keep the
  opponents they were dealt until that table ends. Nothing is discarded,
  rewritten or re-cast mid-event. New tables started afterwards seat the cast
  normally.

**Career.**

- A roster seat is now `{residentId, personalityKey, faceColorIdx}`;
  `residentId` is null for a visitor or a legacy seat.
- `normalizeCareerRoster()` rejects a duplicated resident outright and still
  accepts a legacy archetype-only field.
- The seven curated events' `rosterKeys` became `rosterResidents`. The curated
  mechanism itself is unchanged. `career-events-checks.js` expectations were
  updated to the new cast — an authorised product change, not a weakened
  assertion.
- **`career.active.roster` is a paid term and is never redrawn.** An event
  already entered keeps its seated field until it settles.
- `migrateCareer()` gained one idempotent step: drop entries from the **unpaid**
  `career.rosters` preview book whose seats carry no `residentId`, so the
  directory advertises the cast the player is about to meet. That book costs
  nothing and is regenerated on the next visit. No money, unlock, counter,
  champion status, cash state or lifetime statistic is touched, and
  `CAREER_SAVE_VERSION` stays 6 (`rosters` has always been optional in
  `isValidCareer()`).

### Player-visible surfaces

One model, `dossierModel(subject)`, backs both. It returns exactly
`{residentId, name, faceColorIdx, style, blurb, tendencies, visitor, mood, rest}`
and contains nothing the player cannot already see. `mood` is read from
`faceMood` alone — the same state that already decides which portrait is on the
felt — and is present only for a live seat.

**House Faces screen** (`#opponents`). Reached from the existing `.pc-cast-drawer`
on the main menu, which was already the machine's cast window and is now the
control that opens it. No new menu button was added. It uses the `#awards`
cabinet construction exactly, and `#opponents` was written into every
enumerated selector list in `css/06-machine-system.css` §5 — a screen that clones
the markup but is missing from those lists renders in the older, flatter language,
which is how a new panel quietly becomes a second design system.

Portrait tiles restate the House Faces drawer's own construction (dark green
well, near-black rim, chunky drop). They deliberately do **not** reuse
`.cdir-hf`/`.cdir-seat`, which are the Career printed-**ticket** roster and are
painted in paper colours that belong on paper.

**In-game dossier** (`#dossier-sheet`). Each opponent's full seat module gained
`role="button"`, `tabindex="0"` and an accessible name, plus click and
Enter/Space handlers. This preserves a minimum 46×129px target even on the
eight-opponent 320px layout, while the focus ring remains visually anchored to
the avatar. The sheet joins the `#settings-sheet` machine-dressing lists, and
both it and the House Faces screen render through the same `dossierCardHTML()`.

The dossier opens only at a presentation-stable reading moment: the human's
decision or the completed-hand pause. It waits briefly for an already-finishing
card, chip or showdown flight, and refuses to open if live play resumes. This
prevents the established scrim from hiding a body-level physical effect while
its timer continues behind the sheet. No poker state or AI timer is paused or
rewritten. Closing restores focus to the originating opponent module; while
closed, the sheet is both `aria-hidden` and `inert`.

**A pre-existing hazard was closed.** The global keyboard handler mapped
`f`/`c`/`r` straight to fold/call/raise whenever a human action was pending, with
no overlay check — so typing `f` with Settings open folded the hand. Since the
dossier is opened mid-hand by design, that handler now returns early while any
menu is over the table, and Escape closes the overlay.

## Behavioural evidence

`validation/resident-behaviour-checks.js` runs a seeded, **paired** simulation.
Each trial's equity is computed once and cached before anyone acts; each resident
then decides the same hand, in the same spot, with the random stream reset to the
same seed. Any difference in the tallies is caused by the dials and nothing else.

Headline figures at `hard`, unopened four-handed preflop:

| | fold | call | raise | bluff-raise |
|---|---|---|---|---|
| Tony | 60.0% | 38.9% | 1.1% | 0.5% |
| Harry | 64.2% | 28.9% | 6.8% | 3.7% |
| Steve | 81.1% | 15.8% | 3.2% | 2.6% |
| Lucy | 85.3% | 12.1% | 2.6% | 2.1% |
| Nigel | 88.4% | 10.0% | 1.6% | 1.1% |

And on a dry flop, checked to them:

| | check | bet | bluff-bet | mean equity when betting |
|---|---|---|---|---|
| Harry | 61.2% | 38.8% | 17.1% | 0.412 |
| Steve | 67.6% | 32.4% | 12.9% | 0.424 |
| Lucy | 75.9% | 24.1% | 9.4% | 0.426 |
| Tony | 84.1% | 15.9% | 1.8% | 0.541 |
| Nigel | 84.1% | 15.9% | 1.8% | 0.539 |

Ten checks assert the identities hold, using scale-free metrics where a raw gap
would be confounded by baseline looseness:

- Harry's combined aggression exceeds Nigel's by >10 points and his bluffing by
  >5, while still folding to a raise more than 15% of the time.
- Tony enters and calls clearly wider than Lucy, stays with a live flush draw far
  more than Nigel, and still folds a bricked board a quarter of the time.
- Lucy attacks with a stronger average holding than Harry, bluffs less, traps a
  monster (42.5% check-back) more than anyone, and still applies pressure.
- Nigel gives up the largest **fraction** of his range both out of position and
  against a near-pot bet, and the standard he demands to continue rises most.
- Steve's sizing spread is >1.3× anyone else's, and a paired gear battery runs
  every resident twice on identical hands at high and low gear: only Steve's
  decisions change, and he is >10 points more aggressive in a high gear. The
  other four are identical decision-for-decision.
- Every returned action is checked for legality on every decision.
- Ordering holds at easy / medium / hard / expert / elite while decision quality
  (the equity separation between what they attack with and what they fold)
  improves with difficulty.

## Validation

| Script | Result |
|---|---|
| `card-flight-checks.js` | 11 |
| `card-flight-options-checks.js` | 11 |
| `card-turn-checks.js` | 10 |
| `career-events-checks.js` | 112 |
| `career-result-checks.js` | 41 |
| `chatter-checks.js` | 9 (was 8; one added) |
| `chip-motion-checks.js` | 11 |
| `holiday-gameplay-checks.js` | 20 |
| `quick-bet-checks.js` | 14 |
| **`resident-behaviour-checks.js`** | **10 (new)** |
| **`resident-personality-checks.js`** | **28 (new)** |
| `scoring-audit.js` | exit 0, 0 divergences |
| `scoring-checks.js` | 170 |
| `showdown-rail-checks.js` | 43 |

JavaScript syntax checks pass on every file. `RESIDENT_DEBUG=1` on the behaviour
file prints the raw tallies behind every assertion — tuning a profile without
seeing those numbers is guesswork.

## Rendered verification

Codex verified House Faces and the live table at 390×844 and 320×700 with no
horizontal overflow. Selection updates in place and retains keyboard focus; an
eight-opponent table keeps every dossier target at 46×129px; the sheet fits at
320×700 with Close visible; close returns focus; and a dossier request during
active AI play is rejected. The owner retains final visual sign-off, so this
pass remains uncommitted.

## Deferred, deliberately
- **Relationship counters.** `CAREER_DESIGN.md`'s Phase 7 also specifies three
  per-resident counters (encounters, knockouts either way). They are a Career
  save change and are not identity, so they are out of scope here.
- **Chatter in production.** The registry is compatible with the authored line
  library and the boundary is clean, but table talk stays silenced.
- **The Back Room boss, cash expansion and later venues.** Untouched.
