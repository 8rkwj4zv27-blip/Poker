# Career Mode — Build Plan

Status: approved prototype sequence  
Baseline date: 2026-08-22

This plan implements the design in `CAREER_DESIGN.md` in small, testable stages. `STATUS.md` records which stage is current.

## Prototype objective

Prove that choosing between events, risking a persistent bankroll, cashing, busting, rebuilding, and seeing the next venue creates a compelling repeatable career loop.

Do not build the full career ladder to answer that question.

## Phase 1 — Paid places and Pub Circuit Open — COMPLETE (2026-08-23)

Extend the data-driven event schema without breaking saved active events:

- Represent payout places rather than a single winner-only prize.
- Preserve existing Back Room and Pub descriptors and migrations.
- Add Pub Circuit Open: $300, five players, 750 stack, working Hard AI, $1,050/$450 payouts.
- Settle first and second place exactly once.
- Unlock Card Club preview status only from first place, never second.
- Add focused regression checks for entry, settlement, duplicate-credit prevention, save/resume, and migrations.
- Add a restrained non-winning-cash result state.

Exit condition: all existing Career checks still pass; new Top-2 checks pass; bankroll arithmetic is correct for win, second, bust, abandon, reload, and repeated settlement calls.

Met on 2026-08-23. Career save version 3; `payouts` is the canonical reward
table with `prize` kept as an enforced mirror of first place. Placement is
measured from the table by `careerFinishPlace()` rather than inferred from a
win/loss value, including the standard tie-break for players busting on the
same hand. 27 focused event checks and 24 focused result checks pass.

Two pre-existing save defects were corrected as part of this phase, both of
which would have surfaced the moment the schema widened: a version-2 active
snapshot could adopt live catalogue terms instead of the terms already paid,
and an existing Back Room winner would not have received a newly added
sibling event. See `STATUS.md`.

## Phase 2 — Second Chance recovery

- Add the free three-player Second Chance descriptor or equivalent special-event representation.
- Gate it strictly to bankroll below $100.
- Credit $150 additively on a win.
- Keep it repeatable below the threshold and hide it at $100 or above.
- Ensure it cannot unlock Pub or Card Club.
- Test bankroll values including $0, $50, $99, and $100.

Exit condition: a player can never reach a career dead end, and recovery cannot appear while ineligible.

## Phase 3 — Contextual board and Full Circuit

- Add the persistent highest-access line; Back Room is the starting access.
- Implement Recommended, Alternative, Next Target, and Special Opportunity selection.
- Use the working three-buy-in threshold for recommendations.
- Show locked, earned-but-unaffordable, and earned-and-risky states distinctly.
- Add the locked Card Club preview.
- Add Full Circuit showing the current catalogue and all earned access.
- Add in-place second confirmation when entry would cross from Comfortable to Risky.
- Preserve continue/abandon handling for an active event and block double entry.

Exit condition: the five example states described in `CAREER_DESIGN.md` render coherently, including a high-status player rebuilding at low stakes.

## Phase 4 — Pacing validation

- Add the smallest practical private six-player launch path for internal testing; do not add it to the public catalogue.
- Time real three-, four-, five-, and six-player events with Quick Resolve.
- Record event, opening bankroll, result, closing bankroll, and elapsed time manually or with a small local log if that is genuinely cheaper.
- Do not build an analytics platform.
- Decide whether the Hard heads-up change and paid-place pressure heuristic are necessary from observed play, then scope them separately.

Exit condition: real duration and choice data exists, and six-player Quick Resolve pacing is understood well enough to decide whether six-player upper events remain viable.

## Phase 5 — Human playtest gate

Test the complete small loop, not isolated screens.

Key questions:

- Do buy-ins cause meaningful hesitation?
- Are Pub Freezeout and Pub Open understandable before both are played?
- Does either Pub event dominate player choice?
- Does a second-place cash feel positive but clearly below a win?
- Does Second Chance feel fair and coherent?
- Does rebuilding feel financial rather than humiliating?
- Is the locked Card Club noticeable and desirable?
- Do players want another session after a setback?

Proceed to playable Card Club only if the core loop is engaging and the failures are tuning problems rather than structural ones.

## Later, evidence-gated work

After the prototype:

1. Revisit the Card Club event set with measured pacing and outcomes.
2. Measure AI win/cash rates before claiming economy balance.
3. Consider a separate bot-simulation harness only if manual data cannot answer a concrete balance question.
4. Revisit upper-tier buy-ins, stacks, fields, payouts, and satellites.
5. Add higher venues one tier at a time, repeating the playtest gate.

## Change discipline

- One phase at a time.
- Preserve unrelated user changes and existing saves.
- Update `STATUS.md` after every completed career milestone.
- Update this file if implementation order or scope changes.
- Update `CAREER_DESIGN.md` only when a product decision changes, not for routine implementation detail.
- Commit documentation changes with the implementation they describe so a future AI can reconstruct the project from Git.

