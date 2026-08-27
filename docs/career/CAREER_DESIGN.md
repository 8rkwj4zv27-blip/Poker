# Poker Faces — Career Mode Design Baseline

Status: approved direction
Baseline date: 2026-08-22
Expansion promoted: 2026-08-25

This is the canonical product-design reference for Career Mode. Read it with:

1. `BUILD_PLAN.md` for implementation phases and boundaries.
2. `STATUS.md` for what is actually implemented and the next task.

If an older conversation, proposal, deck, or prompt conflicts with these files, these files win. Future-catalogue values are working hypotheses, not implementation requirements.

On 2026-08-25 the owner approved an expansion of Career's direction — the soft
poker RPG — and it is recorded here. **Approval is not implementation.** Nothing
in the expanded direction is built. `STATUS.md` remains the only record of what
exists, and every expanded system below names the phase that owns it.

## Design classification

- **Approved principle:** settled product direction.
- **Approved direction:** settled product decision, scheduled to a named phase, not yet built.
- **Prototype commitment:** part of the next playable career pass.
- **Working rule:** chosen default that should be tested and may be tuned.
- **Provisional:** later content or balance requiring evidence.
- **Deferred:** deliberately outside the current build.

## Career fantasy

The player rises from an unknown back-room player to a recognised champion at the most exclusive table.

The career is built around a productive mismatch:

- Status records what the player has proved and is permanent.
- Bankroll records what the player can afford today and remains vulnerable.

A Casino-level player may need to rebuild in the Back Room without losing their Casino status. That cycle of shot, setback, rebuild, and larger shot is the career game.

Money buys entry and opportunity. It never buys stronger cards, in-hand bonuses, AI manipulation, or other gameplay power.

## RPG around the poker, not inside it

**Approved principle.** Career carries an RPG feeling, and it lives entirely
*around* the hand — in who the player is sitting against, what a result means to
their story, and what they have proved. It never reaches inside the deck.

- Nothing in the RPG layer touches card outcomes, odds, hand evaluation, or the
  information available to any player.
- **Bankroll is the sole spendable and volatile Career currency.** It is the one
  axis the player pays out of, and the one that can fall.
- **Permanent status, opponent knowledge and trophies are earned records.** They
  are never spent and never purchased. They are written by what the player did,
  and only by that.
- **What bankroll may buy:** tournament entry, cash-table play, and approved
  cosmetic expression. **What it may never buy:** poker power of any kind,
  venue status, opponent knowledge, or trophies.
- **Explicitly prohibited, permanently: XP, experience levels, perks, power-ups,
  and any additional currency.** Bankroll is the only currency in Career.
- No axis may gate another in a way that can strand a player.

### The four progression axes

**Approved principle.** Career's progression is four independently legible axes,
not one score.

| Axis | What it tracks | Volatility | Exists today | Scheduled |
|---|---|---|---|---|
| Bankroll | Money on hand | Fully volatile; can fall to near zero | Yes — implemented | — |
| Permanent status | Highest venue access; boss first-clears; later, a title | Permanent, never revoked | Highest access exists in the unlock set | Board presentation Phase 5; boss first-clears Phase 8; titles Phase 13 |
| Opponent knowledge | Who the player has played, beaten, and lost to | Permanent, append-only | No | Minimal record Phase 7; full dossiers Phase 13 |
| Trophies | Milestones the player has earned and displays | Permanent, earned only, never purchased | No | Phase 14 |

Career record — events entered, best finish per venue, head-to-head against each
resident — is the poker-native texture that a numerical XP track would otherwise
be invented to supply. It is **approved direction, Phase 13**. Only the three raw
per-resident counters from Phase 7 exist before that.

## Approved principles

- Career is persistent, not a roguelite run.
- No run resets, perk drafting, random rewards, meta-currency, debt, or career deletion.
- **Real no-limit Texas Hold'em remains the game.** Tournament progression is
  freezeout-only, and every venue unlock comes from a freezeout first place.
  **One carve-out exists:** the Back Room cash table, described below, is the
  single non-freezeout format in Career. It is Back Room only, permanently, and
  it grants no status.
- Bankroll persists between events and can rise or fall indefinitely.
- Venue access and status never re-lock because of financial losses.
- Only first place unlocks the next venue. A non-winning cash pays money but grants no status.
- The core event payout families are winner-take-all, Top-2, and eventually Top-3.
- Event variety comes from field size, stack depth, blind pace, opponent composition, buy-in, payout, and qualification—not new RPG systems.
- Cash Cut is abandoned.
- Bankruptcy always has a playable recovery route.
- Financial setbacks receive neutral “rebuilding” language, never humiliation or reputation loss.
- The board shows a small contextual selection plus a Full Circuit view, and shows the complete venue ladder from its first version.
- Satellites, seats, and upper-tier content are valuable later features, not requirements for the next prototype.

## Core loop

### Tournament loop — the career spine

Choose event → pay buy-in → play freezeout → win, cash, or bust → settle bankroll and any first-place unlock → choose the next risk.

Results mean:

- **Win:** receive the first-place prize and trigger any associated permanent unlock.
- **Cash without winning:** receive the relevant placed prize; no unlock.
- **Bust:** receive no prize; existing status remains unchanged.

Settlement is always:

`closing bankroll = opening bankroll - buy-in + total prize received`

Prize figures mean the total credited after the buy-in has already been deducted, never net profit.

### Optional cash loop — Back Room only

**Approved direction, Phase 9. Not implemented.** This is a separate, optional
loop that sits alongside the tournament spine and never replaces it:

Choose Back Room cash table → pay $50 buy-in → play completed hands → Resume or Cash Out → return the full remaining stack to bankroll.

- A session ends only by cash-out, by a human bust, or by the table closing.
  Cash-out and table close return the player's **full remaining stack**; a human
  bust returns nothing.
- **Cash play never grants venue access, a boss first-clear, or any tournament
  progression.** It moves bankroll and nothing else on the status axis.
- What cash play *may* do is inform opponent knowledge, which shares one identity
  per resident across both loops. See *Residents, rosters, and opponent
  knowledge*.

## Prototype economy and events

Starting bankroll is **$500**.

These are prototype commitments:

| Event | Entry | Field | Stack | AI | Payout | Access |
|---|---:|---:|---:|---|---|---|
| Back Room 3-HAND | $100 | 3 | 500 | Medium | $300 to 1st | Available from career start |
| Pub Circuit 4-HAND | $300 | 4 | 750 | Hard | $1,200 to 1st | Win Back Room 3-HAND |
| Pub Circuit 5-HAND | $300 | 5 | 750 | Hard working default | $1,050 to 1st; $450 to 2nd | Win Back Room 3-HAND |
| Second Chance | Free | 3 | 500 | Medium | $150 to 1st | Bankroll below $100 only |

The 5-HAND's 70/30 split is a prototype value to test, not a universal approved ratio for every future event.

### Open design issue — the threat ladder (raised 2026-08-27)

**Not addressed in the ticket-integration pass, and deliberately not
changed by it.** No event difficulty, AI behaviour or threat label was
touched.

> The current threat ladder reaches SERIOUS too early, including near the
> beginning of the Pub Circuit. Threat terminology and AI progression
> require a dedicated Career balance pass so the language communicates a
> steady climb from welcoming introductory tables to genuinely elite
> late-career opposition.

Today the ladder has only two rungs — `careerThreatOf()` returns
`MODERATE` for `difficulty:'medium'` and `SERIOUS` for everything else —
so the Pub Circuit's first paid event already reads as the top of the
scale, with nothing left to escalate to across four further venues. The
balance pass owns both halves of the problem: the vocabulary, and the AI
progression the vocabulary is describing. It should be scheduled as its
own phase rather than folded into presentation work.

### Event naming

Renamed on 2026-08-27 at the owner's direction. Entries, fields, stacks, AI,
payouts, access rules and save ids are all unchanged — this was a vocabulary
decision, not an economy one.

- **The venue says where. The event title says which table. The details say how
  it is structured.** A title never repeats the venue marker printed directly
  above it in the directory.
- The old titles named the *format* (`FREEZEOUT`) or implied a format
  distinction that does not exist (`OPEN`). All four events are freezeouts and
  the expanded details still say `FORMAT  FREEZEOUT`; a title that also said so
  was noise, and `OPEN` was actively misleading.
- Each descriptor therefore carries two names:
  **`title`** — the short label the directory prints (`3-HAND`, `4-HAND`,
  `5-HAND`, `SECOND CHANCE`), used only where the venue marker is already
  above it; and **`name`** — the venue-qualified record name
  (`BACK ROOM 3-HAND`, `PUB CIRCUIT 4-HAND`, `PUB CIRCUIT 5-HAND`,
  `SECOND CHANCE`), used by saves, settled results and any copy with no venue
  heading, because "4-HAND" alone does not say where it was played.
- Save identifiers are **permanently** `back-room-freezeout`, `pub-freezeout`
  and `pub-open`. They are not renamed to match the titles: they are the save
  schema, and no display change is worth a migration.
- Genuinely different future formats get genuinely different names — HEADS-UP,
  SHORT STACK, DEEP STACK, BOUNTY — and only when the format actually differs.

Card Club Freezeout appears as a locked preview but is not playable in this pass. From Board v1 it is one row of the complete locked ladder rather than the only future venue shown; see *Contextual career board*.

### The Back Room cash table

**Approved direction, Phase 9. Not implemented.** One permanent cash game sits
outside the tournament ladder and answers a need freezeouts cannot: a short
session with a clean, immediate stop point, and an early rebuilding route that
is not free money.

Approved parameters:

| Property | Value |
|---|---|
| Venue | Back Room only, permanently |
| Field | Four-handed — the human plus three named residents |
| Buy-in | $50 |
| Blinds | $1 / $2 |
| Starting stack | 50 chips |
| Effective depth | 25 big blinds |
| Chips | One table chip equals one Career dollar |
| Rake | None |
| Cash-out | Full stack, between completed hands only |
| Opponents | Named residents with finite session bankrolls |
| Table close | When too few players remain |
| Status | Grants no venue unlock, ever |

- **Whole-dollar currency is a firm project rule.** There are no cents, no
  decimal bankroll values, no fractional blinds, no exchange rate, and no
  separate chip denomination anywhere in Career. A $50 buy-in is 50 chips; the
  big blind is 2 chips, which is $2.
- **25 big blinds is intentional for the prototype.** This is deliberately not a
  deep cash game. Shallow depth is what keeps a session short enough to be worth
  opening. Its pacing and its poker quality are both open questions for the
  Phase 11 playtest gate, which must answer whether play at that depth stays
  recognisably good poker rather than collapsing into preflop shoving. The depth
  does not change before that gate reports.
- **Cashing out at a local maximum is accepted cash-poker behaviour**, not an
  exploit to design against. The table is contained by permanently low stakes
  and finite opponent bankrolls — never by rake or artificial cash-out
  restrictions. Its hourly rate is fixed forever while tournament buy-ins scale,
  so it self-obsoletes as a grind.
- **Working rules, to be tested at Phase 9 and Phase 11:** each resident holds a
  session bankroll that resets per session and may rebuy from it until it is
  gone, then leaves; the table closes when fewer than three players remain, and
  a table close returns the player's full stack rather than busting them; a human
  bust closes the session with nothing returned; leaving the table screen is not
  a forfeit and the session persists exactly as it does across an app close; the
  Board offers exactly two actions on an open session, Resume or Cash Out; the
  $50 buy-in uses the same Comfortable → Risky second confirmation tournament
  entries use.
- A player may not enter a tournament while a cash session is open, and may not
  open a cash session while a tournament event is active.

## Money ownership and cash-session safety

**Approved direction, Phase 9. Not implemented.** These principles govern the
cash table when it is built; nothing about them is true of the code today.

- **`felt.career` is the single authoritative ledger** for Career bankroll and
  for the financial state of an open cash session. A table snapshot may hold
  gameplay state — seats, chips in play, hand state — but **must never own
  money**.
- **Entry and settlement are atomic and idempotent.** The entry transaction
  (session id, buy-in, opened timestamp) is written in the same operation that
  debits bankroll, so there is never a window in which the buy-in has left
  bankroll with no record of it. Settlement credits the returned amount and
  clears the open-session entry in one operation, guarded by a settled marker
  keyed to the session id.
- **No money is ever counted twice.** Bankroll and money on the table are
  distinct figures, and the Board shows both plus an explicit total.
- **Cash sessions never pass through placement settlement.** A cash session has
  no finish place; the tournament placement and settlement paths are not
  extended to cover it.
- **The session is persisted only at completed-hand boundaries**, so every
  resumable session is by construction between hands and Cash Out from the Board
  always succeeds. A mid-hand app kill rewinds to the start of that hand; this is
  an accepted cost of the guarantee.
- **Corrupt-session recovery is ordered and never invents money:** prefer the
  last valid completed-hand snapshot; if the gameplay snapshot is unusable but
  the ledger holds a valid entry transaction, refund **only the recorded buy-in**
  and close the session; never reconstruct or infer an unknown stack; recovery is
  idempotent and can never produce a duplicate refund. Discarding an unreadable
  session as though it never existed is prohibited — the buy-in has already been
  debited, and that would silently destroy the player's money.

## Contextual career board

The prototype board contains up to four contextual cards plus Full Circuit access.

1. **Recommended:** the standard event at the highest permanently unlocked tier where bankroll is at least three buy-ins.
2. **Alternative:** the paid sibling at that tier, otherwise the standard event one tier below. Do not label it “Safer” until playtesting proves that claim.
3. **Next target:** the next financial rung above Recommended, shown as locked, earned-but-unaffordable, or earned-and-risky.
4. **Special opportunity:** Second Chance when bankroll is below $100. Future seats may also use this area, but their collision rules are deferred with the seat system.

Full Circuit always shows the current career catalogue grouped by venue, including permanently unlocked venues the player cannot presently afford.

### The Career event directory — shipped presentation

**Approved principle, implemented 2026-08-25 by owner direction.** The Career
screen is a physical **event directory**: one cabinet holding two visibly
separate machines.

- The **player instrument** at the top is personalised. It carries the player's
  name on an inset identification plate, the bankroll as the dominant mechanical
  figure, and three restrained readouts — highest access, events played, events
  won. It uses the player-selected palette and recolours with it.
- The **event directory** beneath it is a fixed house machine and deliberately
  does **not** follow the player's palette. It is a vertically scrolling column
  of recessed room bays, cheapest and easiest at the top, with cost, field and
  table threat rising downward.
- All six venues are present from the first version. A venue with no implemented
  event shows one compact locked compartment door and **no invented content**:
  no descriptor, buy-in, payout, unlock rule or opponent exists for it.
- Each implemented event is a chunky cassette carrying only its name, its entry
  price and any required state flag. Selecting one extends a detail tray whose
  real layout height pushes later events down the directory. One tray is open at
  a time, and opening one writes nothing.
- The open tray shows the opponent lineup, `TABLE THREAT: MODERATE` or
  `SERIOUS`, entry, players, stack, format, payout, the availability or unlock
  requirement, and the primary action.
- Locked and unaffordable events remain **inspectable**: their terms and
  opponents are visible while the action stays unmistakably unavailable.

This is the presentation the Phase 5 contextual selection logic will be built
into. It is a map and a status readout, never a shop.

### Two aggregate counters

**Approved direction, pulled forward from Phase 13 by explicit owner decision on
2026-08-25.** The player instrument needs truthful figures, so Career persists
exactly two aggregate counters and nothing else:

| Counter | Increments |
|---|---|
| `eventsPlayed` | once when an event is successfully entered, in the same saved mutation that establishes the active event and debits the buy-in. Free Second Chance entry counts. Rejected entries, resumes and reloads do not. |
| `eventsWon` | once when an event settles as a genuine first place. A non-winning cash, a bust and a forfeit do not. Second Chance first place does. |

They are **aggregates only**. Event history, venue records, head-to-head
records, dossiers, milestone titles and every other Phase 13 record feature
remain unbuilt and unscheduled by this change. Totals are never inferred from
`lastResult`, unlocks or lifetime statistics; a save without them starts at zero.

**Approved direction.** There is **one Board**, extended in place. The contextual
card logic above is the base layer, built once and never rebuilt.

**The complete six-venue ladder is visible from Board v1** — Back Room, Pub
Circuit, Card Club, Casino Floor, High Roller Room, Invitational Championship —
with unreached venues visibly locked. This supersedes the earlier arrangement in
which Card Club alone appeared as a locked preview, and it is the cheapest
signal that the career is six stages deep.

The Board is a **map and a status readout**. It is not a shop. Cosmetic
purchases, when eventually tested at Phase 15, belong on the machine itself.

| Board element | Phase |
|---|---|
| Event directory presentation: player instrument, six room bays, event cassettes, detail trays, `eventsPlayed` / `eventsWon` | **Shipped 2026-08-25, owner-directed, outside the phase sequence** |
| Bankroll; status line and immediate objective; four contextual cards with entry states and confirmation; Second Chance slot; active event Continue / Abandon; full locked ladder | 5 |
| Authoritative named fields on every event card | 7 |
| Boss presence at Back Room | 8 |
| Cash table as an opportunity; money committed to an open session; explicit total funds; Resume / Cash Out | 9 |
| Whatever of the above remains unfinished | 10 |

**Excluded from the Board through the Back Room slice:** duration estimates,
cosmetics, trophies, and any large records interface. A duration estimate cannot
be honest before the Phase 6 measurements exist, and a coarse band derived from
field size would be a guess presented as information.

### Status and language

- A persistent line shows the player's highest permanent access.
- Back Room is the player's starting access; never display “Highest access: none.”
- A lower Recommended event reflects finances only.
- Use language such as “Rebuilding at the Back Room.”
- Never say or imply the player has been demoted or no longer belongs at an earned venue.

### Bankroll guidance

The three-buy-in Comfortable threshold is a working board rule, not certified balance.

- Comfortable: bankroll is at least three times the event buy-in.
- Risky: the event is affordable but bankroll is below three buy-ins.
- Unaffordable: bankroll is below the buy-in.
- Recovery: bankroll is below $100.

If no event is Comfortable, Back Room remains Recommended and accurately shows whether it is Risky or unaffordable.

Once the cash table exists (Phase 9), the Recovery state below $100 contains
**two** affordable options rather than one: Second Chance, and the $50 cash
table. Both must read as legitimate rebuilding routes.

### Entry protection

Working decision: keep entry on the event card. If paying the buy-in would take the player from Comfortable to Risky for that tier, the first tap expands the card and asks for an explicit second confirmation. Use concrete remaining-bankroll language rather than internal labels. Comfortable entries remain one tap.

No meaningful buy-in may be spent by one accidental tap. The same rule covers the
cash table's $50 buy-in when it exists.

## Recovery

Second Chance is a prototype commitment:

- Visible only below $100.
- No buy-in.
- Three-player Medium-AI freezeout using the Back Room stack.
- $150 is added to the player's existing bankroll on a win.
- Repeatable while the bankroll remains below $100.
- Disappears once bankroll reaches $100 or more.
- Never grants a venue unlock.

Its frequency, emotional effect, and potential for deliberate exploitation must be observed in playtesting rather than assumed.

### The ordering invariant

**Approved principle.** The $100 threshold is a **fixed approved value**. It is
**not** derived from the cheapest playable opportunity — deriving it would couple
a free-money route to a balance knob. The relationship to the cash table is
expressed as an invariant instead:

```
cash buy-in ($50)  <  recovery threshold ($100)  ≤  cheapest tournament buy-in ($100)
```

Any future tuning of the cash buy-in or the cheapest tournament buy-in must
preserve this ordering.

Eligibility is written once, as a **single shared predicate**, in the Second
Chance work at Phase 2. The Board reads that predicate rather than restating it,
so the recovery rule is never implemented twice.

Boundary validation set: **$0, $49, $50, $99, $100, $101.**

| Bankroll | Second Chance | Cash table (Phase 9) | Back Room Freezeout |
|---:|---|---|---|
| $0 | Visible | Unaffordable | Unaffordable |
| $49 | Visible | Unaffordable | Unaffordable |
| $50 | Visible | Affordable | Unaffordable |
| $99 | Visible | Affordable | Unaffordable |
| $100 | Hidden | Affordable | Affordable (Risky) |
| $101 | Hidden | Affordable | Affordable (Risky) |

## Residents, rosters, and opponent knowledge

**Approved direction, Phase 7 (minimal) and Phase 13 (full). Not implemented.**
This reverses the earlier exclusion of career history, records, and
recurring-opponent progression; see *Outside the current build* below.

- **Venues have a stable cast** rather than an anonymous AI pool re-rolled per
  event. A resident has a fixed authored identity: portrait, public
  playing-style line, and short background. All authored, never generated.
- **One identity, two kinds of encounter.** Cash-table and tournament meetings
  both feed **one** relationship with each resident. What cash play must never do
  is grant venue status, count as a boss first-clear, or satisfy tournament
  progression — that is a boundary on what cash play *unlocks*, not on what it is
  allowed to *inform*. Cash and tournament statistics may be shown as separate
  lines, but always as two facets of one character. A cash-table bust must never
  read as, or be mistakable for, a tournament elimination or a boss result.
- **The minimal relationship record (Phase 7), per resident:** encounters,
  player knockouts of that resident, resident knockouts of the player. Nothing
  else. Those counters and the authored style line are surfaced on the field
  preview, so the opponent-knowledge axis is testable at the Phase 11 gate.
- **Roster authority is a hard requirement — and it is now BUILT** (owner-directed
  pass, 2026-08-27; see `STATUS.md`). The roster shown before entry is the roster
  that launches and resumes.
  - The open code question is answered: AI personality **was** randomised per
    table launch, independently of the preview, and the preview portraits were
    not a roster at all but a seat-index colour formula. The advertised faces
    and the dealt opponents were therefore never the same table.
  - The mechanism: an anonymous field of personality key + face colour is drawn
    **once per event instance**, held in `career.rosters`, and moved into
    `career.active.roster` — a **paid term**, exactly like buy-in and payouts —
    at the moment the player commits. It drives the preview, the launch, the
    active save and the resume, and it is retired when the event settles.
  - **Phase 7 is unchanged in scope.** It replaces the anonymous field with
    authored named residents and adds the three relationship counters. It no
    longer has to invent the authority mechanism, only to name the people in it.
- **Bounded data.** Authored copy lives in code or data and never in the save.
  The save holds the counters per character plus, later, a fixed-size ring of
  flagged moments (cap five per character) storing event keys, never free text.
- **Later, at Phase 13:** full dossiers with authored reveal copy selected by
  encounter thresholds — never generated — the flagged-moment ring, the career
  record, hand-authored milestone titles one per venue, and a rotating
  featured/visitor slot driven by completed events rather than any real-world
  timer. **Staple events never rotate:** the Back Room 3-HAND, the Pub events,
  and the cash table are always available.

## Bosses

**Approved direction, Phase 8 (Back Room). Not implemented.**

- Each venue's top rung is a **named character occupying a guaranteed seat
  inside that venue's existing freezeout** — never a separate boss event.
- **The unlock condition is unchanged.** Winning the Back Room Freezeout unlocks
  Pub Circuit; only first place unlocks anything.
- **The first victory** carries a major first-clear ceremony and the progression
  unlock. **Later appearances** seat the same character as a recurring rival with
  no repetition of that framing, distinguished by a persistent per-venue
  first-clear flag.
- This keeps the boss meaningful while the player grinds or rebuilds at the Back
  Room: the character is always there, but the ceremony happens once.
- Pub Circuit 5-HAND is explicitly **not** a boss event. It remains a Top-2 cash
  opportunity, unrelated to unlock-gating.

## Progression ladder

The six-stage fantasy is approved; exact upper-tier values are provisional:

| Stage | Working buy-in |
|---|---:|
| Back Room | ~$100 |
| Pub Circuit | ~$300 |
| Card Club | ~$1,000 |
| Casino Floor | ~$3,000 |
| High Roller Room | ~$10,000 |
| Invitational Championship | ~$30,000 |

Casino Floor and High Roller Room share one connected physical casino environment, with the High Roller Room presented as a more exclusive internal stage.

The desired first-championship length is provisionally 4–8 hours for a competent player and longer for a struggling player. Do not tune against this target until real event durations, Quick Resolve usage, win rates, and bankroll paths have been measured.

Future stack depths, payout splits, field compositions, durations, and exact event counts are not approved.

## AI progression

The provisional difficulty shape is gradual:

- Back Room: approachable Medium opponents.
- Pub Circuit: stronger Medium/Hard play.
- Card Club: predominantly Hard.
- Casino Floor: advanced Hard with selected Elite opponents.
- High Roller: predominantly Elite.
- Invitational: strongest curated field.

Difficulty should come from visible, fair poker behaviour and opponent composition—not hidden information or a blanket statistical handicap. AI must never use the player's hole cards or future deck information.

**Non-negotiable at every venue:** no hidden card access, no future-deck access,
no rigging, no arbitrary luck bonus, and no unfair starting stack — unless an
event format advertises the imbalance up front as part of its own description.

**Boss AI is a contained change, not a rewrite.** At Back Room the permitted
scope is authored personality — table talk, timing, visible style — plus, at
most, the narrowly scoped short-stack or heads-up tuning that the Phase 6
measurements justify. Position awareness, bubble and pay-jump pressure, and
paid-place pressure belong at Pub Circuit and above, where larger fields and
multi-place payouts make them meaningful.

**Short-stack push/fold logic is shared with Single Player.** If shared
behaviour changes, Single Player receives regression coverage in the same phase.

## Pacing

**Approved principle.** Pacing is measured before it is changed.

The Back Room event is reported to run too long. The response is instrumentation
first, not a faster blind schedule:

- Hands to conclusion
- Median seconds per hand
- Percentage of elapsed time outside human decisions
- Percentage of hands reaching the flop

The last two distinguish a poker-structure problem from a presentation problem.
If a large share of elapsed time is deal animation, AI act delays, and
transitions, then the blind schedule is the wrong lever and changing it would
damage the poker to fix pacing. Flop-seen percentage is the guard against
producing a preflop shove-fest — which would also make a boss's better decision
logic invisible.

**A wall-clock target is not the goal**, and blinds are not accelerated before
measurement. Those findings, at Phase 6, decide stack depth, blind cadence, and
any narrowly scoped short-stack behaviour change.

## Scoring integrity

**Approved principle.** The player must be able to trust what the machine
reports.

**The authoritative scoring reference is `docs/scoring/SCORING_SPEC.md`**, added
2026-08-26 by the Phase 3 audit. It owns the award table, the commentary
catalogue, the hidden-information rule, the lifetime-statistic definitions and
the terminal-hand responsibility split, for **both** Career and Single Player.
This section remains the Career product principle it implements; where the two
touch the same subject, the principle here governs and the spec supplies the
detail.

Event Score is **display-only**. It is not progression, XP, or currency; it never
gates venue access, and it can never become purchasable.

**Settled by the owner on 2026-08-26** (`SCORING_SPEC.md` section 9, decision 1),
after the audit reported: the counter is **kept**, under one canonical
description — *an ephemeral machine tally generated by positive chip results and
objective milestones; not profit, skill, XP or Career progression.* It resets per
event, is never persisted, and gates nothing. Its known bias toward churn and
lucky high-risk play is accepted and recorded rather than mitigated, precisely
because it is display-only.

Two further product decisions were settled in the same pass:

- **Nothing scores a decision.** Every decision-quality award and verdict is
  removed from scoring and from presentation, because the evaluator models
  opponents as uniformly random hands and cannot support the claim. Decision
  analysis is deferred to a separate, separately approved range-model
  workstream.
- **Cards the player was not shown may not affect post-hand feedback at all** —
  not its wording, not its eligibility, and not whether a line appears.

The scoring workstream (Phases 3 and 4) must:

- Define an **authoritative award table**: award name, exact trigger, value,
  presentation timing, and persistence.
- **Audit Career and Single Player separately**, and distinguish Career Event
  Score from Single Player score.
- Identify **false or duplicated awards and payments**.
- **Check all lifetime-statistic persistence.** A false award that persists is
  corrupting a record the project requires preserved.
- **Preserve the approved visual scoring presentation where possible.** The
  chassis is model-driven; corrections that change model values, or when the
  model is built, leave the approved presentation untouched. A timing symptom is
  the one class of fix that may reach into result-stage sequencing.
- **Reverify all four major-result transitions** if timing changes affect them.

Every award is audited across four responsibilities, because a defect in one
presents as a defect in another: **detection** (did the qualifying event happen),
**mutation** (changed by the right amount, exactly once), **presentation timing**
(shown at the right moment, once), and **persistence** (saved, or correctly not
saved).

## Presentation

- **One shared result stage.** Changed 24 August 2026 by owner decision, after Lab approval.
  TABLE CLEARED, RUN OVER, EVENT WON and EVENT LOST are four semantic states of ONE physical
  result chassis with one five-region hierarchy (head, hero, instrument deck, detail well,
  progression strip), presented through one production path (`presentResultStage()`) and the
  one existing stage-wheel transition. No outcome owns a transition, an entrance animation or a
  chassis of its own.
- Wins retain the full result treatment, now expressed on that shared stage.
- A non-winning cash receives a positive but restrained result card, with no full victory roll.
- **Busts turn the stage, as a win does.** Changed 24 August 2026 by owner decision. A win
  and a bust are the two outcomes of the event itself, so both roll into the result on the
  shared physical stage, exactly as TABLE CLEARED and RUN OVER are two faces of one machine.
  The distinction between them is carried by semantic illumination and copy, not by one
  outcome getting a presentation and the other a plain card. A bust does not muck first: its
  K.O. ceremony has already played.
- The restraint that previously applied to a bust now applies only to a non-winning cash,
  which remains a paid place rather than an outcome of the event. `EVENT CASHED` is the one
  result that does not use the shared stage.
- **A result's headline quantity is mechanical.** The prize on a win and the forfeited buy-in on
  a bust roll once on the same reels TABLE CLEARED uses for its table score, and settle. This
  supersedes the earlier rule that every Career amount is an atomic printed string; that rule
  still holds for `EVENT CASHED` and for every secondary statistic on the stage.
- **A result reports the field it was entered into**, from the event's own immutable snapshot
  (`playerCount`) — never the number of players left after eliminations.
- A new permanent venue receives a one-time board reveal.
- **A boss first-clear receives a one-time ceremony**, alongside the one-time venue
  reveal. Later victories over the same character do not repeat it. Approved
  direction, Phase 8.
- Losing financial access produces only a subtle stake/readout movement and neutral rebuilding copy.
- The first Invitational win eventually receives the career's largest presentation, built from the game's existing physical-machine language.

## Cosmetic expression

**Approved direction, Phase 15. Not implemented, and deliberately last among the
RPG-layer additions.**

- Optional purchases affect the **machine itself** — cabinet finish, card backs,
  chip sets — not the Board, which is a map and a status readout.
- Purchases spend **actual bankroll**. No second currency, ever.
- **Nothing purchasable may affect poker odds, AI behaviour, or event access.**
  This is a hard boundary, not a preference.
- A purchase that would drop the player below Comfortable for their highest
  unlocked tier is **hard-blocked**, not merely warned about.
- **Trophies are earned and never purchasable**; purchases are never earnable.
  The two axes stay distinct.
- Price scaling — flat, or scaled to venue tier — is unresolved and belongs to
  Phase 15.

## Deferred satellite and seat rules

Satellites are not part of the next prototype. When implemented:

- Each satellite awards one prepaid seat to one named event.
- The seat bypasses that event's buy-in and qualification once.
- It is consumed on entry.
- Losing grants no permanent access; winning does.
- Seats do not expire.
- A player may hold at most one seat per named event.
- Holding a seat does not count as permanent venue access and cannot unlock satellites hosted there.
- A no-rake satellite should collect approximately the named seat's entry value across its field; any subsidy requires an explicit later design decision.

Satellite opponent composition, exact prices, UI collisions, and final expected value remain provisional.

## Deferred event families

The long-run catalogue is deferred, and splits by cost:

- **Descriptor-level variants** — Turbo, Deep Stack, an ordinary heads-up
  freezeout — fit the existing field-size / stack-depth / blind-pace / AI /
  buy-in / payout / qualification axes. Deferred as scope discipline.
- **State-requiring formats** — knockout bounties need per-elimination payout
  tracking; satellites and private invitations need seat issuance, consumption,
  and qualification state — need mechanisms beyond the current placement-based
  payout shape. Deferred because they are genuinely more work.

## Outside the current build

Deferred, with the phase that owns each where one exists:

- Playable Card Club or any higher venue — Phase 16.
- Satellites, seats, knockout bounties, private invitations, Turbo and Deep Stack variants.
- Full Elite AI.
- Duration estimates on the Board — blocked on Phase 6 measurements.
- Automated board personalisation.
- A new analytics platform or bot-simulation framework.
- Cash Cut or any roguelite system.
- **Additional currencies, XP, perks, and power-ups — excluded permanently, not deferred.**
- Event history, venue records, head-to-head records, dossiers and titles remain
  Phase 13. The two aggregate counters shipped on 2026-08-25 are the sole
  exception and expand no further.

### Exclusions reversed on 2026-08-25

The owner explicitly reversed two entries that previously appeared above.
They are recorded here so the reversal is not mistaken for an oversight:

- **Career history, titles, and records** — now approved direction. Scope-limited:
  only the three per-resident counters and a small amount of authored character
  information at Phase 7; full dossiers, expanded records, and milestone titles
  at Phase 13.
- **Recurring-opponent progression** — now approved direction, as named residents
  (Phase 7) and boss seats with one-time first-clears (Phase 8). The Pub
  expansion at Phase 12 is the first point at which a rival can recur across two
  venues.

*Additional currencies*, which shared a line with career history in the previous
exclusion list, remains excluded permanently.

## Rejected — do not re-propose

- A second currency, XP, perks, or power-ups.
- Rake at the cash table.
- Partial cash-out, or any artificial restriction on cashing out at a local maximum.
- Cash tables at Pub Circuit or above.
- A separate money-owning save key for the cash session.
- Treating an unreadable cash session as if it never existed.
- Deriving Second Chance's threshold from the cheapest playable opportunity.
- A separate boss event, at any venue.
- A wall-clock pacing target, or accelerating blinds before measurement.
- Duration estimates on the Board before Phase 6's data exists.
- The Board as a shop window.
- Building the contextual card logic twice.
- Any phase running in parallel with another.
