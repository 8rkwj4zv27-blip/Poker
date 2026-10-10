# Career Mode — Expansion Plan: The Soft Poker RPG

Status: **owner-directed draft — not canonical, not implemented**
Draft date: 2026-08-25
Revision: 2 (rewritten after senior review and owner decisions of 2026-08-25)

This document is the agreed forward plan for Career Mode after the current
prototype. It is **not** canonical. `CAREER_DESIGN.md`, `BUILD_PLAN.md` and
`STATUS.md` remain authoritative until the owner promotes material from here
into them. Section 10 lists the amendments those files will need at promotion
time.

Revision 2 removes every alternative, open question and phase reference that
the owner's decisions settled. Where an earlier revision offered options, the
chosen option is now stated as the plan and the rejected options are recorded
once, in Section 9, so they are not re-proposed later.

## 1. Reading order

Read `CAREER_DESIGN.md`, `BUILD_PLAN.md` and `STATUS.md` before this document.
This plan assumes the Phase 1 prototype economy (Back Room Freezeout, Pub
Circuit Freezeout, Pub Circuit Open) as its starting state, and assumes
`BUILD_PLAN.md` Phase 2 (Second Chance) completes first and unchanged.

## 2. Classification

- **Owner decision** — settled by the owner on 2026-08-25; not reopened here.
- **Working rule** — a chosen default that should be prototyped and tuned.
- **Provisional** — a value or shape needing evidence before it hardens.
- **Deferred** — deliberately out of scope, named so it is not designed around.

Nothing in this document is an Approved principle or a Prototype commitment
until it is promoted into `CAREER_DESIGN.md`.

## 3. The fantasy

The player rises from an unknown back-room grinder to a recognised name at the
most exclusive table in the game. The RPG structure exists **around** the
poker — in what a hand means to the player's story, not in what happens inside
the deck.

Four progression axes, all read-only records of what happened. None is a
spendable resource, an input to poker odds, or a gate on any other axis:

| Axis | Tracks | Volatility | Status |
|---|---|---|---|
| Bankroll | Money on hand | Fully volatile | Exists |
| Permanent status | Highest venue reached; boss first-clears | Permanent, never revoked | Partly scoped (Phase 5); titles later |
| Opponent knowledge | Who the player has played, beaten, lost to | Permanent, append-only | New (Phase 7 minimal, Phase 13 full) |
| Trophies | Milestones the player has earned and displays | Permanent, earned only | New (Phase 14) |

**Owner decision.** No XP, no perks, no power-ups, no second currency. Bankroll
is the only currency in Career, permanently.

Career record (events entered, best finish per venue, head-to-head against each
resident) is the poker-native progression texture that a numerical XP track
would otherwise be invented to supply. It is approved as direction (Section 4)
and phased at Phase 13; only the three raw counters in Phase 7 exist before that.

## 4. Career scope reversal — recorded explicitly

**Owner decision, 2026-08-25.** `CAREER_DESIGN.md`'s "Explicitly outside the
next build" list currently excludes *career history, titles, records* and
*recurring-opponent progression*. The owner is **reversing those exclusions** as
approved phased Career direction.

This reversal is scope-limited on purpose:

- **In the first Back Room slice:** the minimal resident foundation only — one
  identity shared across cash and tournament play, an encounter count, player
  knockouts of that resident, resident knockouts of the player, and a small
  amount of authored character information (portrait, public style line, short
  background).
- **Later phases:** full dossiers, expanded records, milestone titles,
  controlled rotation, trophies.
- **Still excluded, permanently:** XP, perks, power-ups, additional currencies.

`CAREER_DESIGN.md` must be amended at promotion time to record this reversal and
its scope limit; see Section 10.

## 5. Systems

### 5.1 Money ownership

**Owner decision.** `felt.career` is the **single authoritative ledger** for
Career bankroll and for the financial state of an open cash session. A table
snapshot may hold gameplay state (seats, chips in play, hand state) but **must
never own money**. Entry and settlement are atomic and idempotent.

Consequences that follow directly:

- The cash session's **entry transaction** — session id, buy-in amount, opened
  timestamp — is written into `felt.career` in the same operation that debits
  bankroll. There is no window in which the buy-in has left bankroll but no
  record of it exists.
- **Settlement** — cash-out, bust, or table close — credits the returned amount
  and clears the open-session entry in one operation, guarded by a settled
  marker keyed to the session id, mirroring the existing duplicate-credit guard
  on tournament settlement.
- **No money is ever counted twice.** Bankroll and money on the table are
  distinct figures; the Board displays both plus an explicit total (Section 5.5).
- **Cash sessions never pass through placement settlement.** A cash session has
  no finish place; `careerFinishPlace()` and `normalizeCareerSettlement()` are
  tournament paths and must not be extended to cover it.
- `felt.career` gains new fields, so this is a **schema version bump with a
  migration**: existing saves have no open session, which is a valid empty
  state, not a migration hazard. The new fields get the same validator
  discipline `STATUS.md` records for `payouts`/`prize` — a malformed open-session
  entry is rejected rather than trusted.
- Career tournament snapshots and Single Player saves are unaffected in shape.
  Cash logic reads tournament active-event state only to enforce mutual
  exclusion (Section 5.2), and never writes it.

### 5.2 The Back Room cash table

**Owner decision — the prototype, settled:**

- **Back Room only, permanently.** There is no cash table at Pub Circuit, Card
  Club, or any higher venue, now or later.
- **Four-handed** — the human plus three named residents. Reuses the existing
  four-handed table shape.
- **$50 buy-in, $1/$2 blinds, 50-chip starting stack — 25 big blinds.**
- **Full-stack cash-out between completed hands.** Cash-out ends the session and
  returns the entire player stack. There is no partial withdrawal.
- **No rake.**
- **Named residents with finite session bankrolls.**
- **The table closes when too few players remain.**

**Whole-dollar currency is a firm project rule.** One table chip equals one
Career dollar. There are no cents, no decimal bankroll values, no fractional
blinds, no exchange rate, and no separate chip denomination anywhere in Career.
A $50 buy-in is 50 chips; the big blind is 2 chips, which is $2.

**25 big blinds is intentional for the prototype.** This is deliberately not a
conventional deep cash game. The table exists to offer shorter, casual sessions
and rebuilding play, with cash-out available after every completed hand, and the
shallow depth is what keeps a session short enough to be worth opening. Its
pacing and its poker quality are both open questions to be measured at the Back
Room playtest gate (Phase 11) — a 25 big-blind table concentrates play toward
preflop and short-stack decisions, and whether that stays recognisably good
poker is exactly what the gate must answer. Do not describe this table as deep,
and do not change the depth before Phase 11 reports.

**Cashing out at a local maximum is accepted cash-poker behaviour**, not an
exploit to design against. The table is contained by permanently low stakes and
finite opponent bankrolls, not by rake or artificial cash-out restrictions. Its
hourly rate is fixed forever while tournament buy-ins scale $100 → $300 →
$1,000 → $3,000 → $10,000 → $30,000, so it self-obsoletes as a grind while
remaining useful for short sessions and early rebuilds.

**Working rules that fill in the decision:**

- Each resident holds a session bankroll, reset at the start of each new
  session. A busted resident may rebuy from what remains of their own session
  bankroll; when it is gone they leave for that session.
- The table closes when fewer than three players remain (human plus one). A
  table close is a **cash-out, not a bust**: the player's full stack is returned.
- If the **human** busts, the session closes and nothing is returned.
- **Mutual exclusion:** a player may not enter a tournament while a cash session
  is open, and may not open a cash session while a tournament event is active.
  This extends the double-entry block scoped in the contextual-board work.
- **Leaving the table screen is not a forfeit.** The session persists exactly as
  it does across an app close. Only a human bust forfeits the stack.
- **The Board offers exactly two actions on an open session: Resume or Cash Out.**
- **The session is persisted only at completed-hand boundaries.** Every
  resumable session is therefore, by construction, between hands, which is what
  makes Cash Out honourable directly from the Board. A mid-hand app kill rewinds
  to the start of that hand; this is an accepted cost of the guarantee.
- **Entry protection:** the $50 buy-in uses the same Comfortable → Risky second
  confirmation the tournament entry rule uses, evaluated against the cash
  table's own buy-in.

### 5.3 Corrupt cash-session recovery

**Owner decision.** Recovery is ordered, and never invents money:

1. **Prefer the last valid completed-hand gameplay snapshot.** If it validates,
   resume from it.
2. **If the gameplay snapshot is unusable** but the authoritative `felt.career`
   ledger holds a valid immutable entry transaction for the session, **refund
   only the recorded buy-in** and close the session.
3. **Never reconstruct or infer an unknown stack.**
4. **Recovery and settlement are idempotent.** A refund is guarded by the same
   settled marker as an ordinary cash-out; duplicate refunds are impossible
   across reloads, crashes and repeated recovery attempts.

This is deliberately not "treat an unreadable session as if it never existed":
the buy-in has already been debited, and discarding the session would silently
destroy the player's money.

### 5.4 Recovery and the ordering invariant

**Owner decision.** Second Chance keeps its approved **fixed $100 threshold**.
It is **not** derived from the cheapest playable opportunity — deriving it would
couple a free-money route to a balance knob.

The relationship is expressed as an invariant instead:

```
cash buy-in ($50)  <  recovery threshold ($100)  ≤  cheapest tournament buy-in ($100)
```

Any future tuning of the cash buy-in or the cheapest tournament buy-in must
preserve this ordering. Second Chance's own mechanics are unchanged: free, three
players, Medium AI, Back Room stack, $150 credited additively on a win,
repeatable below $100, hidden at $100 or above, never granting an unlock.

**Boundary validation set: $0, $49, $50, $99, $100, $101.** Expected states:

| Bankroll | Second Chance | Cash table | Back Room Freezeout |
|---:|---|---|---|
| $0 | Visible | Unaffordable | Unaffordable |
| $49 | Visible | Unaffordable | Unaffordable |
| $50 | Visible | Affordable | Unaffordable |
| $99 | Visible | Affordable | Unaffordable |
| $100 | Hidden | Affordable | Affordable (Risky) |
| $101 | Hidden | Affordable | Affordable (Risky) |

The eligibility predicate is written once, in the Second Chance work, and the
Board **reads** it rather than restating it — this is what prevents the recovery
rule from being implemented twice.

### 5.5 The Circuit Board

**Owner decision.** The Board shows the **complete locked venue ladder from its
first version** — Back Room, Pub Circuit, Card Club, Casino Floor, High Roller
Room, Invitational Championship — with unreached venues visibly locked. This is
the cheapest possible signal that the career is six stages deep.

There is **one Board**, extended in place. The contextual card logic
(Recommended / Alternative / Next Target / Special Opportunity) approved in
`CAREER_DESIGN.md` is the base layer and is built once, never rebuilt.

The Board the owner specified is the Board **as it stands when the Back Room
slice is complete**. It arrives in two instalments, because its data does:

**Board v1 (Phase 5)** — everything that can be true before residents, boss and
cash exist:

- Career bankroll
- Current status line and immediate objective
- Available tournament opportunities as the four contextual cards, with
  Comfortable / Risky / Unaffordable state and the Risky second confirmation
- Second Chance in the Special Opportunity slot, via the shared predicate
- Active tournament event with Continue / Abandon
- The complete venue ladder with future venues visibly locked

**Board extension (Phases 7–10)** — plugged into the same card shape as each
system lands:

- Authoritative named fields on every event card (Phase 7)
- Boss presence at Back Room (Phase 8)
- The cash table as an opportunity; money committed to an open cash session;
  an explicit total of bankroll plus money on the table; Resume / Cash Out
  (Phase 9)
- Phase 10 exists only to finish whatever of the above is not already complete.

**Excluded from the Board through the Back Room slice:** duration estimates,
cosmetics, trophies, and any large records interface. A duration estimate cannot
be honest before Phase 6's measurements exist, and a coarse band derived from
field size would be a guess presented as information.

**Board responsibility.** The Board is a **map and a status readout**. It is not
a shop. When cosmetic spending is eventually tested (Phase 15), it belongs on
the machine itself — cabinet finish, card backs, chip sets — not on the Board.

### 5.6 The Back Room boss

**Owner decision.** The Back Room boss is a **guaranteed named seat inside the
existing Back Room Freezeout**, not a separate boss event.

- The unlock condition is unchanged: winning the Back Room Freezeout unlocks Pub
  Circuit. Only first place unlocks anything.
- The **first victory** carries the major first-clear ceremony and the
  progression unlock.
- **Later appearances** seat the same character as a recurring rival, with no
  repetition of the first-clear framing. A persistent per-venue first-clear flag
  distinguishes the two.

This keeps the boss meaningful while the player grinds or rebuilds at the Back
Room: the character is always there, but the ceremony happens once.

**Boss AI is a contained change, not a rewrite.** At Back Room, the permitted
scope is authored personality (table talk, timing, visible style) plus, at most,
the narrowly scoped short-stack or heads-up tuning that Phase 6's measurements
justify. Position awareness, bubble and pay-jump pressure, and paid-place
pressure belong at Pub Circuit and above, where larger fields and multi-place
payouts make them meaningful.

**Non-negotiable, at every venue:** no hidden card access, no future-deck
access, no rigging, no luck bonus, no unfair starting stack unless an event
format advertises the imbalance up front as part of its own description.

### 5.7 Residents and the relationship record

**Working rule.** Venues have a stable cast rather than an anonymous AI pool
re-rolled per event. A Back Room resident has a fixed authored identity:
portrait, public playing-style line, short background. All authored, never
generated.

**One identity, two kinds of encounter.** Cash-table and tournament meetings
both feed **one** relationship with each resident. What cash play must never do
is grant venue status, count as a boss first-clear, or satisfy tournament
progression — that is a boundary on what cash play *unlocks*, not on what it is
allowed to *inform*. Cash and tournament statistics may be shown as separate
lines, but always as two facets of one character. A cash-table bust must never
read as, or be mistakable for, a tournament elimination or a boss result.

**The minimal record (Phase 7), per resident:** encounters, player knockouts of
that resident, resident knockouts of the player. Nothing else. The counters and
the authored style line are surfaced on the field preview so the
opponent-knowledge axis is testable at the Phase 11 gate; a vague authored trait
sharpening into a specific observed note, and any standalone dossier screen,
are Phase 13.

**Roster authority — a hard requirement.** The roster shown before entry must be
the roster that actually launches and resumes. The roster is a **paid term**:
captured into the event snapshot at the moment the player commits, exactly as
`applyPaidCareerTerms()` captures buy-in and payouts. `STATUS.md` records two
Phase 1 defects of precisely this class — a snapshot silently adopting live
catalogue terms instead of the terms it was opened with. Phase 7 must verify
against the actual code whether AI personality is currently randomised per table
launch, and pin or seed it at commitment time either way.

**Bounded data.** Authored copy lives in code/data and never in the save. The
save holds the three counters per character plus, later, a fixed-size ring of
flagged moments (cap five per character) storing event keys, never free text.

### 5.8 Scoring integrity

**Owner decision.** Second Chance completes first, because it is the current
canonical task. Immediately afterward, scoring specification, audit and
correction become **blocking prerequisites before any Career balancing or
playtesting**. Playtesting a machine that pays false scores contaminates every
observation.

The scoring work must:

- Define an **authoritative award table**: award name, exact trigger, value,
  presentation timing, and persistence.
- **Audit Career and Single Player separately.**
- **Distinguish Career Event Score from Single Player score.**
- Identify **false or duplicated awards and payments**.
- **Check all lifetime-statistic persistence** — a false award that persists is
  corrupting a record the project requires preserved.
- **Preserve the approved visual scoring presentation where possible.** The
  chassis is `resultStageHTML(model)` driven by a model; corrections that change
  model values or when the model is built leave the approved presentation
  untouched. The timing symptom is the one that may reach into
  `presentResultStage()` sequencing.
- **Reverify all four major-result transitions** if timing changes affect them.

Every award is audited across four responsibilities, because a defect in one
presents as a defect in another: **detection** (did the qualifying event
happen), **mutation** (changed by the right amount, exactly once), **presentation
timing** (shown at the right moment, once), **persistence** (saved, or correctly
not saved).

**Event Score remains display-only** pending the audit. It is not progression,
XP or currency, and it never gates venue access or becomes purchasable.

### 5.9 Pacing

**Owner decision.** "Single-digit minutes" is not the target, and blinds are not
accelerated before measurement. Instrument first:

- Hands to conclusion
- Median seconds per hand
- Percentage of elapsed time outside human decisions
- Percentage of hands reaching the flop

The last two are what distinguish a poker-structure problem from a presentation
problem. If a large share of elapsed time is deal animation, AI act delays and
transitions, then the blind schedule is the wrong lever and changing it would
damage the poker to fix pacing. Flop-seen percentage is the guard against
producing a preflop shove-fest, which would also make the boss's better decision
logic invisible.

Those findings decide stack depth, blind cadence, and any narrowly scoped
short-stack behaviour change. **Short-stack push/fold logic is shared with
Single Player**: if shared behaviour changes, Single Player receives regression
coverage in the same phase.

### 5.10 Event structure

The long-run catalogue — Turbo, Deep Stack, heads-up challenge, satellites,
private invitations, knockout bounties — is **deferred**, and splits by cost:

- **Descriptor-level variants** (Turbo, Deep Stack, an ordinary heads-up
  freezeout) fit the existing field-size / stack-depth / blind-pace / AI /
  buy-in / payout / qualification axes. Deferred as scope discipline.
- **State-requiring formats** (bounties need per-elimination payout tracking;
  satellites and private invitations need seat issuance, consumption and
  qualification state) need mechanisms beyond the placement-based `payouts[]`
  shape. Deferred because they are genuinely more work.

**Staple events never rotate.** The Back Room Freezeout, the Pub events and the
cash table are always available. Controlled rotation (Phase 13) applies only to
a featured/visitor slot, and is driven by completed events, never a real-world
timer.

## 6. The Back Room vertical slice

The slice is everything delivered by Phases 7, 8, 9 and 10, tested in Phase 11.
It asks one question: **does a single venue with named residents, a guaranteed
boss seat, a real cash table and an authoritative visible field feel like a
richer place to play than a flat event list — before that treatment is repeated
everywhere?**

Contents:

1. A coherent Back Room cast: named residents used by both the three-handed
   freezeout and the four-handed cash table, with one identity across both.
2. The Back Room Freezeout, poker rules and settlement unchanged, with the boss
   as a guaranteed named seat and a first-clear ceremony on first victory.
3. The Back Room cash table at the settled prototype parameters.
4. The Board extended with named fields, boss presence, cash opportunity, money
   on the table, total funds and Resume / Cash Out.
5. The minimal relationship record, surfaced on the field preview.

Excluded from the slice: Pub reskinning, full dossiers, titles, trophies,
rotation, cosmetics, duration estimates, and any second venue's residents.

## 7. Phase plan

One phase at a time. No phase runs in parallel with another.

### Phase 1 — Paid places and Pub Circuit Open — COMPLETE

Recorded in `BUILD_PLAN.md` and `STATUS.md`. Unchanged by this plan.

### Phase 2 — Second Chance

- **Purpose:** guarantee no career dead end; establish the recovery predicate.
- **Scope:** `BUILD_PLAN.md` Phase 2 exactly as written — free three-player
  descriptor, gated strictly below $100, $150 credited additively on a win,
  repeatable below the threshold, hidden at $100 or above, never unlocking a
  venue. Expose eligibility as a **single shared predicate** the Board will later
  read.
- **Exclusions:** no cash table, no derived threshold, no board work.
- **Dependencies:** none. Current canonical task.
- **Exit:** the $0 / $50 / $99 / $100 set passes; Second Chance can never unlock
  a venue; a player can never reach a dead end. Both focused check suites pass.

### Phase 3 — Scoring specification and audit

- **Purpose:** restore trust in scoring before any balancing or playtesting.
- **Scope:** the authoritative award table (name, trigger, value, presentation
  timing, persistence); a read-only trace of every award through detection →
  mutation → presentation → persistence; Career and Single Player audited
  separately; Career Event Score distinguished from Single Player score; a full
  check of lifetime-statistic persistence; reproducible fixtures (seeded deck
  plus scripted action list) in the style of the existing `validation/` checks.
- **Exclusions:** no code change; no design proposal for scoring's future shape.
- **Dependencies:** Phase 2.
- **Exit:** every award type is mapped; every reported symptom (wrong timing,
  false positive, incorrect payment) is attributed to a specific responsibility
  layer; every fixture is replayable; the lifetime-statistics question is
  answered yes or no in writing.

### Phase 4 — Scoring correction

- **Purpose:** fix what Phase 3 found, before anything is measured or playtested.
- **Scope:** determined by the audit's findings; fixtures retained as permanent
  regression checks; approved visual presentation preserved where possible; all
  four major-result transitions reverified if timing changes affect them.
- **Exclusions:** any scoring feature not implicated by a reported symptom; no
  change to Event Score's status as display-only.
- **Dependencies:** Phase 3.
- **Exit:** the three reported symptoms are resolved, covered by fixtures, and
  both existing check suites still pass; any corrupted lifetime statistic is
  addressed explicitly.

### Phase 5 — Contextual Board and visible Full Circuit

- **Purpose:** build the Board base layer, once.
- **Scope:** Board v1 as specified in Section 5.5 — bankroll, status line and
  immediate objective, the four contextual cards with Comfortable / Risky /
  Unaffordable state, the Risky second confirmation, Second Chance via the shared
  predicate, active-event Continue / Abandon with double entry blocked, and the
  complete six-venue ladder with future venues visibly locked.
- **Exclusions:** named fields, boss presence, cash entry, duration estimates,
  cosmetics, trophies, records interface.
- **Dependencies:** Phase 2 (predicate), Phase 4 (nothing is surfaced on an
  untrusted score).
- **Exit:** the five example board states in `CAREER_DESIGN.md` render
  coherently, including a high-status player rebuilding at low stakes; the locked
  ladder reads as ambition, not as broken rows.

### Phase 6 — Back Room pacing instrumentation and decision

- **Purpose:** find out where the time actually goes before changing the poker.
- **Scope:** instrument hands to conclusion, median seconds per hand, percentage
  of elapsed time outside human decisions, percentage of hands reaching the flop;
  timed real three-handed Back Room events; a written decision on stack depth,
  blind cadence and any narrowly scoped short-stack behaviour change; Single
  Player regression coverage if shared AI behaviour changes.
- **Exclusions:** no blind acceleration before measurement; no wall-clock target;
  no boss AI work; no analytics platform.
- **Dependencies:** Phase 4.
- **Exit:** the four measurements exist for real events; a stack-depth and
  cadence decision is recorded with the evidence behind it; flop-seen percentage
  after any change confirms the event has not become a preflop shove-fest.

### Phase 7 — Named residents, roster authority, minimal relationship record

- **Purpose:** the identity foundation everything else in the slice depends on.
- **Scope:** authored Back Room residents (portrait, public style line, short
  background) covering the freezeout's two opponents and the cash table's three;
  one identity across both formats; the three counters per resident (encounters,
  player knockouts of them, their knockouts of the player); roster captured as a
  paid term at commitment; verification of whether AI personality is currently
  randomised per launch, and pinning it either way; named fields and the counters
  surfaced on the Board's event cards.
- **Exclusions:** no dossier screen, no threshold-based reveal copy, no titles,
  no records interface, no second venue.
- **Dependencies:** Phase 5.
- **Exit:** the roster shown pre-entry is exactly the roster that launches and
  that resumes after a reload; counters increment correctly from both formats
  once Phase 9 exists, and from tournaments immediately.

### Phase 8 — Back Room boss seat and first-clear ceremony

- **Purpose:** give Back Room a top rung with ceremony that does not erode.
- **Scope:** the boss as a guaranteed named seat in the existing Back Room
  Freezeout; a persistent per-venue first-clear flag; the major first-clear
  ceremony and unlock on first victory; recurring-rival framing thereafter;
  authored boss personality plus only the contained AI tuning Phase 6 justified.
- **Exclusions:** no separate boss event; no change to the unlock rule; no
  wholesale AI rewrite; no Casino-tier boss work; no position, bubble or
  pay-jump work.
- **Dependencies:** Phases 6 and 7.
- **Exit:** the boss occupies the seat every time; the first win produces the
  ceremony and the Pub unlock exactly once; a second win does not repeat the
  first-clear framing; both check suites pass.

### Phase 9 — Back Room cash table

- **Purpose:** a short session with a clean stop point, and an early rebuild
  route that is not free money.
- **Scope:** the full prototype from Section 5.2 — four-handed, $50 buy-in,
  $1/$2 blinds, 50-chip starting stack at 25 big blinds, whole-dollar chips; the
  money-ownership model from Section 5.1 including the schema bump, validator and
  idempotent atomic entry and settlement; corrupt-session recovery from Section
  5.3; resident session bankrolls and table close; mutual exclusion with
  tournaments; persist-at-hand-boundaries; entry protection on the $50 buy-in.
- **Exclusions:** no rake; no partial cash-out; no cash table at any other
  venue; no artificial cash-out restriction; no cents, decimal bankroll values,
  fractional blinds, exchange rate or separate chip denomination; no change to
  the 25 big-blind depth before Phase 11 reports; no economy verdict — this phase
  produces the session, Phase 11 produces the judgement.
- **Dependencies:** Phases 5 and 7.
- **Exit:** a full session (buy-in, several hands, cash-out, resume after app
  close, human bust, table close by resident attrition) behaves correctly against
  every invariant; forced-corruption and repeated-settlement tests produce
  exactly one credit or exactly one recorded-buy-in refund and never both; the
  boundary set $0 / $49 / $50 / $99 / $100 / $101 renders the states in Section
  5.4; no path counts the same dollar twice.

### Phase 10 — Board extension for live cash, boss and field state

- **Purpose:** finish the Board for the slice.
- **Scope:** only what Phases 7, 8 and 9 have not already surfaced — the cash
  table as an opportunity, money committed to an open session, an explicit total
  of bankroll plus money on the table, and Resume / Cash Out as the only two
  actions on an open session.
- **Exclusions:** duration estimates, cosmetics, trophies, records interface.
- **Dependencies:** Phases 7, 8, 9.
- **Exit:** an open cash session is unmistakable on the Board; money is never
  ambiguous or apparently missing; Cash Out from the Board always succeeds
  because the persisted session is always between hands.

### Phase 11 — Back Room playtest gate

- **Purpose:** decide whether the treatment is worth repeating.
- **Scope:** the existing `BUILD_PLAN.md` Phase 5 questions, scoped to Back
  Room, plus: does the named cast and boss seat feel richer than a flat list;
  does the cash table get used for short sessions; what is the measured hourly
  rate of cash play against tournament play; does the first-clear ceremony land;
  do the resident counters register as knowledge; is the dump-to-recovery route
  (deliberately losing at cash to fall below $100 and repeat Second Chance)
  something players actually do. **Plus the two questions the 25 big-blind depth
  raises:** does a session end at a natural point soon enough to be worth
  opening, and does play at that depth stay recognisably good poker rather than
  collapsing into preflop shoving. Record hands per session, session length, and
  percentage of hands reaching the flop at the cash table alongside the
  qualitative answers.
- **Exclusions:** no Card Club work regardless of outcome; no new venues.
- **Dependencies:** Phase 10.
- **Exit:** proceed only if the loop plus the slice's additions are engaging and
  the failures are tuning problems rather than structural ones.

### Phase 12 — Pub Circuit expansion

- **Purpose:** repeat the proven pattern at the second venue.
- **Scope:** Pub residents and a Pub boss seat in the existing Pub Circuit
  Freezeout; Pub fields on the Board; the first point at which a resident can
  recur across venues.
- **Exclusions:** no new event types; no Pub cash table.
- **Dependencies:** Phase 11 passing.
- **Exit:** Pub shows on the Board at the same fidelity as Back Room; a
  recurring rival is legible as the same character across two venues.

### Phase 13 — Full dossiers, expanded records, titles, controlled rotation

- **Purpose:** the opponent-knowledge and status axes at full strength.
- **Scope:** dossier display with unified cash and tournament lines; authored
  reveal copy selected by encounter thresholds, never generated; the flagged-
  moment ring; career record (events entered, best finish per venue,
  head-to-head); hand-authored milestone titles, one per venue; a rotating
  visitor slot driven by completed events, with staples never rotating.
- **Exclusions:** no XP, no currency, no purchasable knowledge, no daily timers.
- **Dependencies:** Phase 12.
- **Exit:** a resident's dossier is meaningfully sharper after real encounters
  of either kind; staples never rotate away; the save's per-character data stays
  within its declared bounds.

### Phase 14 — Trophies

- **Purpose:** the earned-display axis.
- **Scope:** trophies awarded automatically for permanent milestones already
  tracked (first venue win, first boss clear, first elimination of a recurring
  rival); display only, no mechanical effect.
- **Exclusions:** trophies are never purchasable, never crafted, never a currency.
- **Dependencies:** Phase 13.
- **Exit:** every trophy maps to a milestone already recorded elsewhere; no
  trophy can be obtained by spending.

### Phase 15 — Cosmetic spending experiment

- **Purpose:** test whether spending bankroll on expression is enjoyable.
- **Scope:** a small set of purchases on the machine itself — cabinet finish,
  card backs, chip sets — bought with bankroll; the tournament-entry confirmation
  pattern reused; a **hard block** on any purchase that would drop the player
  below Comfortable for their highest unlocked tier.
- **Exclusions:** no second currency; no purchase with mechanical effect on
  cards, odds, AI or access; no purchasable trophies; the Board is not a shop.
- **Dependencies:** Phase 12 at minimum, so bankroll headroom above the top tier
  played actually exists.
- **Exit:** hoarding, regret and runway effects are observed and reported from
  real play; the hard block is never circumvented.

### Phase 16 — Card Club gate, then higher venues one at a time

- **Purpose:** the existing evidence-gate discipline, unchanged.
- **Scope:** the `BUILD_PLAN.md` playtest gate, extended to ask whether the RPG
  layer holds up over a real session; then Casino Floor, High Roller Room and
  Invitational Championship, one venue at a time, each behind its own gate.
- **Exclusions:** no upper-tier economy numbers invented beyond the ladder
  `CAREER_DESIGN.md` already provisions; no cash table at any of these venues.
- **Dependencies:** Phases 11 and 12 at minimum.
- **Exit:** per-venue, the same gate passes before the next is built.

## 8. Deferred

Named so they are not silently designed around: satellites and seats; knockout
bounties; private invitations; Turbo and Deep Stack variants; heads-up challenge
formats; duration estimates on the Board; Elite AI; bot simulation or analytics
infrastructure; automated board personalisation; any venue above Card Club.

## 9. Rejected — do not re-propose

- A second currency, XP, perks, or power-ups.
- Rake at the cash table.
- Partial cash-out, or any artificial restriction on cashing out at a local
  maximum.
- Cash tables at Pub Circuit or above.
- A separate money-owning save key for the cash session.
- Treating an unreadable cash session as if it never existed.
- Deriving Second Chance's threshold from the cheapest playable opportunity.
- A separate Back Room boss event.
- A wall-clock "single-digit minutes" pacing target, or accelerating blinds
  before measurement.
- Duration estimates on the Board before Phase 6's data exists.
- The Board as a shop window.
- Building the contextual card logic twice.
- Any phase running in parallel with another.

## 10. Conflicts requiring canonical amendment at promotion

Promotion of this plan requires these explicit amendments; none should happen
silently:

1. **`CAREER_DESIGN.md` — "Explicitly outside the next build."** Remove *career
   history, titles, records* and *recurring-opponent progression* from the
   exclusion list, and record the scope limit in Section 4. *Additional
   currencies* stays excluded, permanently.
2. **`CAREER_DESIGN.md` — "Real no-limit Texas Hold'em freezeouts remain the
   game."** A permanent Back Room cash table is not a freezeout. The principle
   needs an explicit carve-out naming the cash table as the one non-freezeout
   format, Back Room only, permanently.
3. **`CAREER_DESIGN.md` — prototype economy table.** Add the cash table row
   ($50 buy-in, four-handed, $1/$2 blinds, 50-chip starting stack at 25 big
   blinds, one chip per dollar, no rake, no payout structure) and state that it
   grants no status.
4. **`CAREER_DESIGN.md` — contextual board.** The Board shows the complete
   six-venue ladder from v1, which goes beyond the current "Card Club appears as
   a locked preview" and beyond Full Circuit's "current career catalogue".
5. **`CAREER_DESIGN.md` — bankroll guidance.** The Recovery state below $100 now
   contains two affordable options (Second Chance and the $50 cash table), not
   one. Record the ordering invariant from Section 5.4.
6. **`CAREER_DESIGN.md` — presentation.** Add the boss first-clear ceremony as a
   one-time state alongside the one-time venue reveal, and state that later
   victories do not repeat it.
7. **`CAREER_DESIGN.md` — AI progression.** Record that boss identity is a seat
   within an existing event, and that Back Room boss AI is limited to authored
   personality plus measurement-justified contained tuning.
8. **`BUILD_PLAN.md` — phases.** Existing Phase 2 is unchanged. Existing Phase 3
   becomes Phase 5 here. Existing Phase 4 is replaced by the narrower, metric-
   specific Phase 6. Existing Phase 5's gate becomes Phase 11 (Back Room) and
   Phase 16 (Card Club). The "later, evidence-gated work" list maps onto Phases
   12–16.
9. **`STATUS.md` — at implementation time only.** The Career save schema version
   will bump when `felt.career` gains open-cash-session fields, with a migration
   row for saves that have no open session.

## 11. Genuinely unresolved

Small, and none blocks Phase 2 through Phase 5:

- Exact resident count and cast at Pub Circuit (Phase 12 scope question).
- The size of each resident's session bankroll at the cash table, and whether it
  resets per session as this plan's working rule assumes (Phase 9).
- Whether a resident who leaves a cash session can be replaced by another named
  character, or whether the table simply shortens toward its close condition
  (Phase 9).
- Whether the cash table's 25 big-blind depth survives Phase 11 unchanged. The
  depth is settled for the prototype and must not be altered before the gate
  reports; what the gate finds about session length and flop-seen percentage may
  reopen it afterwards.
- Cosmetic price scaling — flat, or scaled to venue tier (Phase 15).
- Whether Event Score survives in any form after the Phase 3 audit reports.
- Whether the dump-to-recovery route needs a mitigation, to be judged from
  Phase 11 observation rather than assumed.

This document remains a draft. No proposal above is approved by virtue of
appearing here.
