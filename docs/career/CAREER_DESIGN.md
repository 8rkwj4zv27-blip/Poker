# Poker Faces — Career Mode Design Baseline

Status: approved direction for the next prototype  
Baseline date: 2026-08-22

This is the canonical product-design reference for Career Mode. Read it with:

1. `BUILD_PLAN.md` for implementation phases and boundaries.
2. `STATUS.md` for what is actually implemented and the next task.

If an older conversation, proposal, deck, or prompt conflicts with these files, these files win. Future-catalogue values are working hypotheses, not implementation requirements.

## Design classification

- **Approved principle:** settled product direction.
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

## Approved principles

- Career is persistent, not a roguelite run.
- No run resets, perk drafting, random rewards, meta-currency, debt, or career deletion.
- Real no-limit Texas Hold'em freezeouts remain the game.
- Bankroll persists between events and can rise or fall indefinitely.
- Venue access and status never re-lock because of financial losses.
- Only first place unlocks the next venue. A non-winning cash pays money but grants no status.
- The core event payout families are winner-take-all, Top-2, and eventually Top-3.
- Event variety comes from field size, stack depth, blind pace, opponent composition, buy-in, payout, and qualification—not new RPG systems.
- Cash Cut is abandoned.
- Bankruptcy always has a playable recovery route.
- Financial setbacks receive neutral “rebuilding” language, never humiliation or reputation loss.
- The board shows a small contextual selection plus a Full Circuit view.
- Recurring opponents, career history, titles, satellites, and upper-tier content are valuable later features, not requirements for the next prototype.

## Core loop

Choose event → pay buy-in → play freezeout → win, cash, or bust → settle bankroll and any first-place unlock → choose the next risk.

Results mean:

- **Win:** receive the first-place prize and trigger any associated permanent unlock.
- **Cash without winning:** receive the relevant placed prize; no unlock.
- **Bust:** receive no prize; existing status remains unchanged.

Settlement is always:

`closing bankroll = opening bankroll - buy-in + total prize received`

Prize figures mean the total credited after the buy-in has already been deducted, never net profit.

## Prototype economy and events

Starting bankroll is **$500**.

These are prototype commitments:

| Event | Entry | Field | Stack | AI | Payout | Access |
|---|---:|---:|---:|---|---|---|
| Back Room Freezeout | $100 | 3 | 500 | Medium | $300 to 1st | Available from career start |
| Pub Circuit Freezeout | $300 | 4 | 750 | Hard | $1,200 to 1st | Win Back Room Freezeout |
| Pub Circuit Open | $300 | 5 | 750 | Hard working default | $1,050 to 1st; $450 to 2nd | Win Back Room Freezeout |
| Second Chance | Free | 3 | 500 | Medium | $150 to 1st | Bankroll below $100 only |

The Pub Open's 70/30 split is a prototype value to test, not a universal approved ratio for every future event.

Card Club Freezeout appears as a locked preview but is not playable in this pass.

## Contextual career board

The prototype board contains up to four contextual cards plus Full Circuit access.

1. **Recommended:** the standard event at the highest permanently unlocked tier where bankroll is at least three buy-ins.
2. **Alternative:** the paid sibling at that tier, otherwise the standard event one tier below. Do not label it “Safer” until playtesting proves that claim.
3. **Next target:** the next financial rung above Recommended, shown as locked, earned-but-unaffordable, or earned-and-risky.
4. **Special opportunity:** Second Chance when bankroll is below $100. Future seats may also use this area, but their collision rules are deferred with the seat system.

Full Circuit always shows the current career catalogue grouped by venue, including permanently unlocked venues the player cannot presently afford.

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

### Entry protection

Working decision: keep entry on the event card. If paying the buy-in would take the player from Comfortable to Risky for that tier, the first tap expands the card and asks for an explicit second confirmation. Use concrete remaining-bankroll language rather than internal labels. Comfortable entries remain one tap.

No meaningful buy-in may be spent by one accidental tap.

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

A targeted Hard heads-up improvement and a simple paid-place pressure heuristic are candidates for the prototype only if they are contained changes. They must not turn the prototype into a wholesale AI rewrite.

## Presentation

- Wins retain the existing full result treatment.
- A non-winning cash receives a positive but restrained result card, with no full victory roll.
- Busts retain the plain loss treatment.
- A new permanent venue receives a one-time board reveal.
- Losing financial access produces only a subtle stake/readout movement and neutral rebuilding copy.
- The first Invitational win eventually receives the career's largest presentation, built from the game's existing physical-machine language.

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

## Explicitly outside the next build

- Playable Card Club or any higher venue.
- Satellites and seats.
- Full Elite AI.
- Recurring-opponent progression.
- Career history, titles, records, or additional currencies.
- Automated board personalisation.
- A new analytics platform or bot-simulation framework.
- Cash Cut or any roguelite system.

