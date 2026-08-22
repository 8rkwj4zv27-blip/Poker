# Career Mode — Current Status

Last verified: 2026-08-22  
Verified implementation baseline: `ee733b2` — `Add two-event Career foundation` (later documentation-only commits do not change this implemented state)

This is the short handoff file. Update it whenever a Career milestone is completed or the immediate next task changes.

## Implemented now

- Career is a separate game mode using ordinary freezeout poker and standard AI.
- Persistent save key: `felt.career`, schema version 2.
- Starting bankroll: $500.
- Data-driven live catalogue with immutable active-event snapshots.
- Back Room Freezeout: three players, $100 entry, $300 winner-take-all, 500 stack, Medium AI.
- Pub Circuit Freezeout: four players, $300 entry, $1,200 winner-take-all, 750 stack, Hard AI.
- Pub Circuit permanently unlocks after a Back Room win.
- Buy-in is deducted and persisted before table launch.
- Active events can be resumed without a second charge.
- Abandoning an event forfeits the paid buy-in without awarding a prize or unlock.
- Settlement is guarded against duplicate credit and stores bankroll plus cleared active state atomically.
- Career table saves are separate from ordinary Single Player saves.
- Career has its own result presentation and returns to the event screen.
- Quick Resolve is available in the underlying elimination-table flow.
- Version-1 Career saves migrate to the current two-event structure.

## Existing focused checks

- `node validation/career-events-checks.js`
- `node validation/career-result-checks.js`

Run both before and after every Career implementation phase.

Last baseline verification on 2026-08-22:

- 12/12 focused Career event checks passed.
- 12/12 focused Career result checks passed.

## Not implemented

- Multi-place payouts or placement-aware settlement.
- Pub Circuit Open.
- Second Chance recovery.
- Contextual board, permanent-status line, or Full Circuit.
- Card Club preview.
- Cash-without-win presentation.
- Six-player Career pacing harness.
- Satellites, seats, Card Club gameplay, or higher tiers.

## Immediate next task

Phase 1 from `BUILD_PLAN.md`: extend the event schema and settlement path for multi-place payouts, then add Pub Circuit Open without altering the existing Back Room or Pub Freezeout behaviour.

Minimum completion requirements:

- Existing active-event snapshots and old saves remain valid or migrate safely.
- First receives $1,050; second receives $450; other finishes receive $0.
- Only first place can satisfy a venue-unlock requirement.
- Entry and settlement remain exactly-once transactions.
- Existing Career checks pass and new placement checks cover win, cash, bust, abandon, reload, and duplicate settlement.

## Working decisions to validate

- Pub Circuit Open uses Hard AI initially.
- The board uses a three-buy-in Comfortable threshold.
- Risky entries use an in-place second confirmation rather than a new details screen.
- Second Chance pays $150 and appears below $100.
- Exact upper-tier economy, event durations, and the 4–8-hour career target remain unvalidated.

## Do not start next

- Playable Card Club or upper tiers.
- Satellites or seat inventory.
- Full Elite AI work.
- Bot simulation or analytics infrastructure.
- Career history, titles, or recurring-opponent progression.

## Handoff protocol

At the end of any Career task:

1. Record what changed under Implemented now / Not implemented.
2. Set one concrete Immediate next task.
3. Record tests run and their result.
4. Update the verified commit after the work is committed.
5. Move any changed product decision into `CAREER_DESIGN.md` and explain why.
