# Career Expansion Draft — Senior Review

Reviewer role: product design + systems architecture
Review date: 2026-08-25
Subject: `docs/career/CAREER_EXPANSION_DRAFT.md` (non-canonical)
Read against: `CAREER_DESIGN.md`, `BUILD_PLAN.md`, `STATUS.md`

This review changes no canonical document and no code.

## 1. Executive verdict

**Revise.** The direction is right and the draft is unusually honest about its own
uncertainty. It is not yet promotable, for four reasons: it contains one false
architectural claim about money ownership; it silently reverses three approved
exclusions in `CAREER_DESIGN.md`; it sequences a known live scoring defect *after*
the playtest that defect would corrupt; and its vertical slice cannot test the
axis it was built to test. All four are fixable without redesigning the concept.

## 2. Strongest elements

- **"RPG around poker, not inside poker" is the correct spine** and is held
  consistently. Nothing in the draft touches card outcomes, odds, or hidden
  information. The rejection of persistent numerical XP is right: bankroll is
  already a number that rises and falls with real stakes, and XP would import the
  grind pressure the design exists to avoid.
- **Section 5.2.2's transaction invariants** are the strongest systems work here —
  they correctly generalise the existing settlement discipline to an open-ended
  lifecycle, and the "no window where the same money is counted twice" rule is
  exactly the right invariant.
- **Section 8's "one Board, extended in place"** correction is right and kills a
  genuine duplication.
- **Section 5.5.4 (roster authority)** identifies precisely the class of bug that
  already bit this project twice in Phase 1.
- **Section 4's four-responsibility split** (detection / mutation / presentation /
  persistence) is a correct and useful diagnostic frame.
- Self-corrections are visible and dated rather than quietly rewritten. That is
  good draft hygiene.

## 3. Weakest assumptions

1. **That cash-session logic can leave `felt.career` untouched.** It cannot. See §7.
2. **That a cash table needs validation to know whether it becomes the dominant
   grind.** It will, unless something structurally opposes it. A full-stack
   cash-out available at every hand boundary lets the player bank every local
   maximum and never realise a downswing they don't choose to. That is not a
   balance risk to measure; it is a dominant strategy to design against.
3. **That "single-digit minutes" is a pacing target.** It is a symptom target. See §9.
4. **That the Back Room boss and the Back Room rebuild grind can be the same event.**
5. **That recording history invisibly proves the opponent-knowledge axis.**
6. **That 3-handed is the "casual" cash configuration.** 3-handed cash is the most
   demanding form of the game: the player is in a blind two hands in three and is
   effectively forced to play a wide range. It is the shortest configuration, not
   the most casual, and two residents is a thin cast for a "stable regulars" fantasy.

## 4. Factual and internal contradictions

- **§5.2.2 vs. reality.** "`felt.career` … not read or written by cash-session logic"
  is false on the draft's own terms: the buy-in is debited from Career bankroll and
  the cash-out credits it. Career bankroll lives in `felt.career` (`STATUS.md`).
- **Approved exclusions reversed without saying so.** `CAREER_DESIGN.md` lists
  "Career history, titles, records" and "Recurring-opponent progression" as
  *explicitly outside the next build*. The draft proposes a status title, a career
  record, and recurring rivals, and claims "nothing is silently dropped" — but never
  states that it is asking to reverse an approved exclusion.
- **Duration field.** §5.1 recommends shipping a coarse duration band; §6 item 4
  excludes duration estimates from the slice.
- **Implementation convenience.** §5.2.4 explicitly withdraws reuse-cost as a valid
  criterion, then uses it in its own recommendation ("where it is also the cheapest option").
- **Cash containment.** §5.2 frames the cash table as *one* Back Room fixture outside
  the ladder; §9 makes every future venue eligible for "the same … cash-table …
  treatment." Those are different economies.
- **Cash-out reachability.** Cash-out is "only at a safe between-hands checkpoint,"
  yet the Board offers Cash Out on a session that may have been persisted mid-hand.
- **Stale cross-references.** §3, §4.7, §5.5.4, §5.8 cite "Section 12" and "Section 7"
  for the phase sequence and four-axis model; these are Sections 10 and 5.7. The
  owner-decision list references sections by number, so this matters.
- **Missing dependency.** Step 7's Special Opportunity card depends on step 3
  (Second Chance), which is not listed.
- **Parallelism vs. discipline.** Steps 2 and 5 claim parallel execution;
  `BUILD_PLAN.md`'s change discipline is "One phase at a time." One of the two must give.

## 5. Product-design risks

- **The boss collides with the rebuild loop.** Making the Back Room Freezeout the
  introductory boss event means the player grinds the boss repeatedly while
  rebuilding — the exact cycle `CAREER_DESIGN.md` celebrates. A boss played twenty
  times is a regular. **Better:** a boss is a *named seat*, not an event type. The
  unlock condition stays "win the Back Room Freezeout"; the boss occupies the
  toughest seat, gets a one-time first-clear ceremony, and afterwards becomes a
  recurring rival with dossier history. No new event, ceremony preserved, and the
  rebuild loop stays dignified.
- **The Board carries three jobs.** "Status readout, shop window and map" is too much
  for a phone screen. **Better:** the Board is map + status; cosmetics belong on the
  *machine* (cabinet, card backs, chip sets), reached from the machine itself. That
  is also better fiction — you customise your machine, not the circuit.
- **A progression gap the draft doesn't fill.** Status moves six times in a whole
  career; trophies are rare; bankroll is noise. Between Back Room and Pub, nothing
  ticks. The draft lists "career record" in the Board table, then never designs it,
  never assigns it a phase, and omits it from the four axes. **Promote it:** events
  entered, best finish per venue, and head-to-head vs. each resident are poker-native
  texture that does the job XP would do, without XP.
- **"Estimated duration" as a coarse band** derived from field size, before pacing
  data exists, is a guess wearing the costume of information. Omit the field.

## 6. Economy and exploitation risks

- **The cash table is a risk-off ramp.** Tournaments become the thing you do to
  unlock, funded by a grind that can never lose more than the player consents to.
  **Better than rake:** freeze the Back Room cash table's stakes permanently and
  never add cash tables at higher venues. Its hourly stays fixed while buy-ins scale
  100 → 300 → 1,000 → 3,000 → 10,000 → 30,000, so it self-obsoletes by Card Club while
  still solving short sessions and early rebuilds. **Rake should stay excluded** — it
  taxes the player's time rather than capping the grind, sets a new precedent, and
  makes a losing session feel arbitrarily punished.
- **Infinite rebuys remove the natural stop.** A "small in-fiction delay" doesn't fix
  it. **Better:** give residents their own session bankroll. When a resident is
  cleaned out they leave for the session; when the table can't fill, it breaks. That
  produces the stopping point the cash table was invented to provide, caps the grind
  honestly without rake, and is pure character.
- **Dump-to-recovery.** With full-stack-only cash-out, a player can buy in, shed
  chips, cash out below $100, and farm the free Second Chance. The route exists today
  via a tournament, but the cash table makes it fast and granular. Worth observing at
  the Phase 2 playtest; the cheap mitigation is Second Chance topping the bankroll up
  to a floor rather than adding a flat $150.
- **50bb is the wrong depth for a character table.** $100 at $1/$2 compresses play
  toward preflop, which is where personality is least visible. **Recommend $50 buy-in
  at $0.50/$1** — 100bb of postflop room, and it lands *below* the recovery threshold,
  which resolves §7 below.

## 7. Transaction and save risks

**The ownership boundary, correctly drawn.** `felt.career` is and must remain the
single authoritative ledger for every off-table dollar. The cash session owns only
*session* state — stack, blinds, seats, open/closed. Two mutations cross the
boundary (debit at open, credit at close) and both must be atomic *with* the
bankroll write.

That is the problem with a separate `felt.career.cash` key. `felt.career.table`
carries no money — the buy-in was already settled into `felt.career` before launch.
A cash stack *is* money. Splitting a money-bearing record across two independently
written keys creates a crash window that either duplicates or destroys funds.
**Recommend: the open-session record lives inside `felt.career`** (e.g.
`felt.career.cashSession`, versioned, validator-enforced), so bankroll and session
settle in one write. Keep the heavy per-hand table snapshot in a separate,
non-money key if convenient.

Further:

- **"Fail conservatively = treat as no session" is the wrong conservative direction.**
  The buy-in was already debited; discarding the session silently destroys the
  player's money. **Better:** record the session's buy-in in the bankroll ledger at
  open; if the session record is unreadable, refund the *recorded buy-in* — a
  known-good figure — and close. Never reconstruct an unknown stack.
- **Only persist at hand boundaries.** Then every resumable session is by
  construction between hands, and the Board's Cash Out is always honourable. Cost: a
  mid-hand kill rewinds to that hand's start. Accept it and state it.
- **Idempotency:** a session id plus a settled-marker, mirroring the existing
  duplicate-credit guard, not a re-derived check.
- **Display:** show bankroll and "on table" as two readouts with an explicit total,
  so money never appears to vanish.
- **Roster is a paid term.** Capture the promised field into the event snapshot at
  entry, exactly as `applyPaidCareerTerms()` captures buy-in and payouts. This is not
  a new pattern; it is the pattern that already failed twice in Phase 1.
- **Bound the character data.** Authored copy stays in code/data, never in the save.
  The save holds counters plus a fixed-size ring of flagged moments (cap ~5 per
  character), storing event keys, never free text.

## 8. Recovery

**Reject the derived threshold.** Deriving Second Chance's gate from "the cheapest
playable opportunity" couples a free-money faucet to a balance knob: tuning the cash
buy-in silently changes how often the game gives money away.

**Better — an ordering invariant, not a formula:**
`cash buy-in < Second Chance threshold ≤ cheapest tournament buy-in`.
With $50 cash and the approved fixed $100 gate, this holds today and the drift risk
disappears. Second Chance stays "unchanged and unblocked" — but only because the
cash buy-in was chosen to keep it so, not automatically. Exact-boundary set to test:
$0, $49, $50, $99, $100, $101.

**Phase-order risk is real:** if the cash table ships before the board surfaces
recovery, the "is anything affordable" rule gets written once in Second Chance and
again in the Board's Special Opportunity logic. Build Second Chance first (as
planned), then have the Board *read* its eligibility predicate rather than restate it.

## 9. Pacing and AI risks

- **Instrument before tuning.** The owner reports Back Room is too long; nobody has
  measured *where* the time goes. If a large share is deal animation, AI act delays
  and transitions, then changing the blind schedule damages the poker to fix a
  presentation problem. **First deliverable: a timing breakdown** (hands to
  conclusion, median seconds per hand, share of elapsed time not spent on a human decision).
- **Target hands, not minutes.** "Single-digit minutes" for a 500-chip 3-hander,
  reached by accelerating blinds, produces a preflop shove-fest — and a shove-fest
  makes the boss's better decision logic invisible, defeating §5.4 entirely. Target
  *hands to conclusion*, with "% of hands reaching a flop" as the health metric that
  guards against the shove-fest. Only then express a minutes band.
- **The 6/8/10 comparison is under-specified.** Hands-per-level is the wrong sole
  variable; starting stack in big blinds and the per-level BB curve determine the
  outcome. Test stack depth (500 vs 750) alongside cadence.
- **Short-stack passivity is not a contained change.** Push/fold logic is shared with
  Single Player. Fixing it will move existing checks and change non-Career play.
  Scope it explicitly as a shared-AI change with regression, or it will quietly
  become the "wholesale rewrite" the draft forbids.
- **AI placement:** at Back Room, only the contained short-stack/heads-up tuning and
  authored personality. Position awareness, pay-jump and bubble pressure belong at
  Pub and above, where fields are larger and multi-place payouts exist to make them meaningful.

## 10. Scoring audit

The four-way separation is correct, and reproducible fixtures are **practical and
cheap** — the repo already has `validation/career-*-checks.js` and a DEV tester that
drives the real path with fixture state; a seeded deck plus a scripted action list is
the natural extension.

The audit is nonetheless **not specific enough** in three ways:

1. **No specification to audit against.** "False award" is undefinable without an
   authoritative table of award name → trigger → amount → timing → persistence,
   sourced from owner intent. Produce that table *first*; half the symptoms may
   resolve into "working as coded, coded wrong."
2. **It doesn't separate Career Event Score from the Single Player score / personal
   best**, which share the result stage. The defect may live in the shared component.
3. **It doesn't ask whether anything is being written to lifetime statistics.** If a
   false award persists, it is corrupting a record `CLAUDE.md` requires preserved.
   That single question determines the fix's urgency and must be answered first.

**Correction must not wait for the playtest gate.** Playtesting a machine that pays
false scores contaminates every observation and the owner's trust in the whole slice.
Fix immediately after the audit.

**Event Score's future shape** can stay undecided — but one thing shouldn't: confirm
now that Career Event Score is display-only and never a progression axis.

**Presentation separability:** yes for detection, mutation and persistence bugs — the
approved chassis is `resultStageHTML(model)` and only the model's values change. Not
guaranteed for the *timing* symptom, which may live in `presentResultStage()`
sequencing, i.e. inside the approved part. Treat timing as the one fix that may touch
approved presentation and gate it on a re-verification of the four transitions.

## 11. Residents and dossiers

- **One relationship fed by both formats is correct.** Familiarity, observed
  tendencies and dossier text are shared; venue status, boss clears and unlock
  eligibility must remain tournament-only and separately labelled. The draft gets
  this right.
- **Authored copy selected by fact thresholds is the right model** and consistent
  with the game's voice. Keep thresholds low (2–3 encounters) so the first sharpening
  lands inside a first session; a reveal nobody reaches is worse than no reveal.
- **Surface a minimal dossier inside the slice.** The draft records history and shows
  none of it, then tests whether the venue "feels richer." It cannot. On the event
  card and the cash table entry, show per-resident: authored style line, played N,
  you knocked out N, they knocked you out N. The data already exists at step 4; the
  cost is a card region. Defer only the standalone dossier screen.

## 12. Circuit Board

**Smallest credible Board:** bankroll (+ "on table" when a cash session is open);
highest-access line; the four contextual cards with Comfortable/Risky/Unaffordable
state and the second confirmation; the named field per card; active event *or* active
cash session with Resume / Cash Out; boss presence at Back Room; Full Circuit with
every future venue shown locked.

**Show the full ladder locked from day one.** It is the cheapest possible ambition
signal, `CAREER_DESIGN.md` already approves it, and hiding it makes a six-stage career
look like a three-event game. **Omit** duration, trophies, career record and cosmetics
from v1.

## 13. Cosmetic spending

Spending bankroll creates *frustrating hoarding*, not good tension, at the stage the
draft proposes testing it. Bankroll is the only thing between the player and
"Rebuilding at the Back Room"; a purchase that causes that is self-inflicted
demotion — precisely the feeling `CAREER_DESIGN.md` forbids. Hoarding is therefore the
rational play until bankroll comfortably exceeds the top tier played.

- A **second currency is genuinely worse** — but the draft misses a third option:
  milestones unlock the *category*, bankroll buys only variants within it.
- **A warning is not enough.** The design's own rule is that no meaningful sum is lost
  to one tap. **Hard-block** any purchase that would drop the player below Comfortable
  for their highest unlocked tier, rather than warning and permitting.
- **Timing:** after Pub expansion, not after the Back Room gate. Before two venues
  exist there is no headroom above the top tier, so the experiment tests nothing.
- **Where:** the live machine (cabinet finish, card backs, chip sets — slots the
  approved visual system already parameterises), with a small reflection on the Board.
  Board-only cosmetics are inert.
- **Trophies stay un-purchasable and purchases stay un-earnable**, on separate shelves.
  Any overlap turns the trophy case into a receipt.

## 14. Recommended phase sequence

Strictly one at a time. No parallel phases.

1. **Second Chance** — `BUILD_PLAN.md` Phase 2, unchanged. Already the next task.
2. **Scoring specification + read-only audit** — award table first, then the trace;
   answer the lifetime-statistics question explicitly.
3. **Scoring correction** — with the fixtures retained as regression checks. Before
   any playtest.
4. **Contextual Board + Full Circuit** — approved Phase 3 scope, its own exit gate.
   Reads Second Chance's eligibility predicate rather than restating it.
5. **Pacing instrumentation and decision** — timing breakdown, hands-to-conclusion
   target, stack-depth × cadence comparison, short-stack finding. Before boss AI.
6. **Character/roster foundation** — `characters` + `opponentHistory`, roster captured
   as a paid term, minimal dossier surfaced on the event card.
7. **Back Room boss** — named seat, contained AI change, first-clear ceremony.
8. **Career cash table** — ownership boundary per §7, resident session bankrolls,
   $50 / $0.50-$1 provisional.
9. **Board extension** — boss presence, real field, cash Resume / Cash Out.
10. **Back Room playtest gate** — including a measured cash-vs-tournament hourly.
11. **Pub expansion** — residents, boss, recurring rivals.
12. **Full dossier screen and featured rotation.**
13. **Trophies.**
14. **Cosmetic experiment.**
15. **Card Club evidence gate**, then higher venues one at a time.

Deferred: trophies, cosmetics, rotation, satellites, bounties, private invitations,
per-venue cash tables, Casino-tier boss AI, duration estimates.

Rejected: derived recovery threshold; rake; a second currency; cash-out as anything
other than full stack; the Board as a shop.

## 15. Owner decisions required before anything becomes canonical

1. **Money ownership** — one record (`felt.career` holds bankroll *and* the open
   session) or two keys? Recommend one.
2. **Cash economy and containment** — buy-in and stakes, and whether the cash table is
   permanently a Back Room fixture that never scales. Recommend $50 / $0.50-$1, Back
   Room only, forever.
3. **Approved-exclusion reversal** — does the owner approve reversing
   `CAREER_DESIGN.md`'s exclusion of career history, titles, records and
   recurring-opponent progression? If not, most of §5.5 and §5.7 leave the slice.
4. **Scoring priority** — correction before the Back Room playtest gate, and is any
   score persisted to lifetime statistics?
5. **Boss shape** — named seat within the existing event (recommended) or a distinct
   boss event; and whether the introductory boss can coexist with Back Room as the
   rebuild grind.

Also required, lower severity: cash table size (3 vs 4 — recommend 4); rebuy model
(resident session bankrolls vs. in-fiction delay); whether the full locked ladder
shows from day one (recommend yes); cosmetics timing (recommend after Pub).

## 16. Exact amendments the canonical plan should make

1. Delete the claim that cash logic leaves `felt.career` untouched; replace with the
   ownership boundary and single-write rule in §7.
2. State the recovery invariant `cash buy-in < recovery threshold ≤ cheapest
   tournament buy-in`; keep Second Chance's approved $100 fixed.
3. Record the approved-exclusion reversals explicitly in `CAREER_DESIGN.md`, or drop
   titles/records/rivals from the slice.
4. Replace "single-digit minutes" with a hands-to-conclusion target plus a
   flop-seen-percentage health metric, and require a timing breakdown first.
5. Move scoring correction ahead of the Back Room playtest gate.
6. Split the draft's step 7 into approved Phase 3 (own gate) and a Board extension.
7. Add a minimal dossier readout to the vertical slice; defer the standalone screen.
8. Remove the duration field from Board v1 and resolve the §5.1/§6 contradiction.
9. Add the persist-only-at-hand-boundaries rule and the refund-recorded-buy-in
   corruption rule.
10. Delete the parallel-phase language; reaffirm one phase at a time.
11. State that short-stack AI work is a shared change affecting Single Player.
12. Fix the stale Section 7 / Section 12 cross-references before the owner decides
    against them.
