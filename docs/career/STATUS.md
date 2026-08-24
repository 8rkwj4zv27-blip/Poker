# Career Mode — Current Status

Last verified: 2026-08-24  
Verified implementation baseline: `cfb317e` — `Round End Update: one shared stage for all four major results`.
Career logic baseline remains `d31b120` — `Add multi-place payouts and Pub Circuit Open` (Phase 1); every commit since has changed result presentation only. Build `v0.21.0-dev · Round End Update`, service-worker cache `poker-v20-0`.

This is the short handoff file. Update it whenever a Career milestone is completed or the immediate next task changes.

## Implemented now

- Career is a separate game mode using ordinary freezeout poker and standard AI.
- Persistent save key: `felt.career`, **schema version 3**.
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

- Second Chance recovery.
- Contextual board, permanent-status line, or Full Circuit.
- Card Club preview.
- Six-player Career pacing harness.
- Satellites, seats, Card Club gameplay, or higher tiers.

## Immediate next task

Phase 2 from `BUILD_PLAN.md`: Second Chance recovery. The unified result stage was approved by
the owner on 24 August 2026 and is committed as `Round End Update`
(build `v0.21.0-dev`, service-worker cache `poker-v20-0`). On-device iPhone verification of the
four transitions is still outstanding — see Not verified.

DEV transition tester (retained for future result work): enable Developer Mode in Settings (or load with `?dev`), open the DEV
panel, and use MAJOR RESULT TRANSITIONS. It drives the real `presentResultStage()` path with
fixture state: no buy-in, no prize, no unlock, no save, no lifetime statistic and no high score
is written. Each result action re-arms the tester so a transition can be watched repeatedly;
RESET TESTER returns to the Main Menu.

The task itself: Second Chance recovery — the free three-player descriptor, gated strictly to a bankroll below $100, crediting $150 additively on a win, repeatable below the threshold, hidden at $100 or above, and unable to unlock Pub or Card Club.

Minimum completion requirements:

- Test bankroll values including $0, $50, $99 and $100.
- Second Chance can never unlock a venue.
- A player can never reach a career dead end.

## Manual checks still outstanding

1. Career screen shows three events; Pub Circuit Open locked until the Back Room is won.
2. Entering Pub Circuit Open drops the bankroll by $300 and deals a five-handed table.
3. Refresh mid-event, then Continue Event — resumes without a second charge.
4. Finish 2nd — `EVENT CASHED`, `+$450`, bankroll up $150 net, no new unlock, and **no stage
   roll**: the restrained plain card over the live felt, exactly as before.
5. Finish 1st — the shared result stage, `EVENT WON`, `+$1,050` on the hero reel.
6. Abandon — buy-in forfeited, no prize, no unlock.
7. Back Room and Pub Circuit Freezeout play and settle exactly as before.
8. Five-handed table layout and the Payout readout are legible on an iPhone.

## Working decisions to validate

- Pub Circuit Open uses Hard AI initially.
- Pub Circuit Open's 70/30 split is a prototype value, not an approved universal ratio.
- Simultaneous-bust tie-break: players busting on the same hand are ranked by the stack they brought to it, and an exactly equal starting stack gives the human the better place. Deterministic and player-favourable, but a judgement call rather than a rule the codebase previously encoded.
- `lastResult.delta` keeps its pre-existing convention: the gross prize when one was paid, otherwise the forfeited buy-in — not net profit.
- The board uses a three-buy-in Comfortable threshold.
- Risky entries use an in-place second confirmation rather than a new details screen.
- Second Chance pays $150 and appears below $100.
- Exact upper-tier economy, event durations, and the 4–8-hour career target remain unvalidated.
- Five-player Career pacing is unmeasured; that is Phase 4's job.

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
