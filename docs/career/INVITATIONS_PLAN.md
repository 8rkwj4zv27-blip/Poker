# Invitations: Career as packets of event invitations (plan)

Written 12 October 2026 with the owner. Status: **Stages 1 and 2 done** (DEV only, not released). Nothing here is decided beyond what it says the
owner decided. Builds on the hub, shop, packet opening and album labs
(`career/HUB_TO_GAME_BRIEF.md`), which are kept as they are.

## The loop being tested (owner, 12 Oct)

Starter packet → discover event invitations → use a card to play its
event → earn Career money → buy more packets.

- The invitation **is** the entry: no cash buy-in. The event supplies the
  table stacks; they are separate from Career money (`career.bankroll`).
- Advertised prizes are put up by the house (`funding:'house'`). The old
  rule "payouts add up to the entries" stays for entry-funded events
  only (`CAREER_DESIGN.md`).
- Rarity (Common, Uncommon, Rare, Legendary) says how scarce an
  invitation is. It never multiplies a prize: each event has its own
  prize terms.
- Venues give theme and setting only. No linear venue progression,
  bosses, satellites, shootouts or story in this prototype.
- The faces TABLE / FREEZEOUT / BOMB / WILD were placeholders. BOMB is
  not a bomb pot. Bomb mechanics and ambitious Legendary formats are
  deferred.

## Confirmed hub direction (for the integration stage, not Stage 1)

- **REDEAL** only brings out or rearranges invitations you own. It never
  makes free cards.
- **The pity packet:** with no playable invitation, no unopened packet,
  no event in progress, and not enough money for the cheapest packet, the
  player is given one battered packet of three basic Common events. It
  must never be given twice for one shortfall (repeat visits, reloads).

## The proposed first catalogue (provisional)

Player counts include you. Only the Back Room is built (Stage 1).

| Rarity | Event | Terms (provisional) |
|---|---|---|
| Common | Back Room | 3 players, 10 hands, all places paid ($60 / $30 / $15, temporary) |
| Common | Full House | 6 players, 10 hands, top three paid |
| Common | Closing Time | 4 players, 20 hands, top three paid |
| Common | Face to Face | 2 players, 10 hands, both places paid |
| Common | Deep Pockets | 4 players, 10 hands, deeper starting stacks |
| Uncommon | Sponsored Night | standard poker, boosted placement prizes |
| Uncommon | Last Stack Wins | 4 players, 10 hands, winner takes all |
| Uncommon | Bounty Night | placement prizes plus knockout bonuses (own stage) |
| Rare | Three's Company | three hole cards each, best five of all (own stage) |
| Rare | The Private Game | 4 players, 20 hands, generous prizes, top two paid |
| Rare | Final Table | 6-player elimination, shallow stacks, rising blinds, top three paid |
| Rare | Pair Pressure | exactly one pair beats every other category (own stage) |
| Legendary | The Golden Ticket | 3 players, 10 hands, very large winner-takes-all, standard poker |

Standard-poker configurations come first. Bounty Night, Three's Company
and Pair Pressure each need their own assessment and stage; unusual rules
must use explicit variant handling and leave normal Hold'em untouched.

## Stage 1: one Back Room invitation, playable from DEV

**Scope:** the event `back-room-invite` (3 players, 10 completed hands,
$60 / $30 / $15, temporary), its hand limit, placement, tie sharing,
save and resume, the HAND n/10 readout, and a DEV key to start or
continue it. No packets, no invitations in the save, no hub loop.

### Rules (defaults recommended 12 Oct, provisional)

- **Hand limit:** only completed hands count. The last hand plays out and
  settles (pots paid, knock-outs resolved) before the event ends.
- **Placing at the limit:** players still seated rank by chips; anyone
  knocked out ranks below every survivor, later knock-outs above earlier
  ones (the existing rule).
- **Early endings:** if you are knocked out, the event ends at once at
  your place. If every opponent is out, you win at once.
- **Ties:** an exact tie (equal chips at the limit, or knocked out on the
  same hand from equal stacks) shares the prizes of the places it covers,
  split evenly and **rounded down to the whole dollar**. Example: tied
  2nd and 3rd share ($30 + $15) / 2 = $22. A shared 1st is a cash, not an
  outright win. Entry-funded events keep their existing tie rule.
- **Money:** the prize is credited once, in the same save write that ends
  the event. A reload after that finds no event to settle.
- **Not counted towards the old Career record:** no venue unlocks, no
  events-played or events-won counters (the prototype must not disturb
  the owner's existing Career progress). The bankroll is credited.
- **Starting stacks and blinds:** as the Back Room 3-HAND (1,000 chips,
  blinds up every 15 hands, opponents at 20 on the skill dial). In ten
  hands the blinds never rise. Provisional.

### Acceptance checks

1. Only completed hands count; hand ten settles fully before the event
   finishes.
2. Survivors rank by remaining chips; knock-outs rank below them.
3. Early knock-out, early table clearance and tied placements settle
   correctly.
4. Exact ties share the relevant prizes evenly, rounded down (documented
   above).
5. A reload keeps the event's terms and hand count, without counting a
   hand twice.
6. The reward is credited exactly once.
7. Existing poker and Career checks stay green (`npm test`).
8. The table visibly shows progress (HAND 3/10) in the existing UI style.
9. Only reachable through DEV; nothing changes for a player without it,
   and existing saves load unchanged.

### Results (12 Oct 2026)

- `npm test`: 25 of 25 suites pass. New checks in `career-events-checks`
  (catalogue, DEV gate, ties, entry, settle once, reload) and
  `career-result-checks` (hand limit, chip placing, ties, limit wording).
- Independent review (a separate agent, commit `60caa0c`): nothing
  blocking; its three minor findings (result wording at the limit, the
  abandon message, play metrics for a shared first) are fixed.
- Real flow, emulated iPhone (`validation/tools/invitation-scenario.js`,
  11 of 11): ten hands played with real taps, a reload during hand 5 came
  back to hand 5 on the same terms, the event ended after hand 10 (2nd on
  chips, $30, credited once and not again after a reload); an early
  knock-out paid 3rd ($15); an early clearance paid 1st ($60) at hand 2.
- Not yet: the owner playing it on the phone; minutes per hand.
- Card preview: https://claude.ai/artifact/K4NmPQASrYC6RoJLepPRP2, on the
  hub's own card coloured by rarity (owner, 12 Oct: Common cream,
  Uncommon green, Rare blue, Legendary yellow; little text, rules on the
  inspect screen later).

## Stage 2: invitations in the save (owner approved the shape, 12 Oct)

**Scope:** the invitations you own, kept in the Career save, and playing
one uses it up. DEV only: DEV keys give a Back Room invitation and play
one. No packets, no hub.

**The save:** `career.invitations`, a list inside the existing
`felt.career` (no new saved key, no save-version change; backups carry it
because they copy `felt.career` whole). Each card: `id`, `eventId`,
`rarity`, `roster` (the opponents drawn when it was given), `addedAt`.
At most 200 cards. A save without the list is an empty collection.

### Acceptance checks

1. A save written before this (no list) loads exactly as before, holds no
   cards, and is not rewritten just by loading.
2. A card given is saved with its event, rarity and opponents; a reload
   keeps it unchanged.
3. Playing a card removes it and starts its event in **one** save write;
   the card's opponents are the ones seated.
4. Playing is refused, changing nothing, when another event or the cash
   table is open, the card is unknown, or its event isn't an invitation.
5. A card can't be played twice: after a play, a reload finds the card
   gone and the event in progress.
6. Invitation events can't be entered without a card.
7. Damaged entries (unknown event, bad rarity, duplicate id) are dropped
   on load without touching anything else in the save.
8. A backup made after giving a card restores it.
9. DEV only. `npm test` green; the real flow in an emulated iPhone: give a
   card, play it, reload mid-event, finish; the count of cards is right
   throughout.

### Results (12 Oct 2026)

- `npm test`: 25 of 25 (and the quick run, 22 of 22, after the review
  fixes). Eight new checks in `career-events-checks` (132 in all), one in
  `save-data-checks` (a backup carries the cards).
- Independent review (commit `c551bdd`): nothing blocking. Four minor
  findings fixed: a card for a normal event is refused outright; the DEV
  key plays a Back Room card specifically; GIVE is off while at a table;
  the preview gives itself a card only when it can play it.
- Real flow, emulated iPhone (12 of 12): no cards at start, GIVE then PLAY
  used the card up (the event records it), a reload mid-event brought no
  card back and resumed hand 5, ten hands paid 2nd ($30) once.

## Next: Stage 3, packets

Starter packet; buying a packet takes the money and stores its cards in
one write (opening it is presentation only, so a reload never re-rolls);
the pity packet (three basic Commons, once per shortfall). Prices and
contents are proposals until simulated.


## Overnight run (approved by the owner, 12 Oct 2026, late)

Goal for the morning: the hub, the shop (packets), the album and the
sample events working together as **New Career (preview)**, kept apart
from the live Career; a link to try on the phone plus this branch. No
merge, no release.

- **Sample events:** the standard-poker ones (Full House, Closing Time,
  Face to Face, Deep Pockets, Sponsored Night, Last Stack Wins, The Private
  Game, Final Table, The Golden Ticket) besides the Back Room. Bounty
  Night, Three's Company and Pair Pressure wait for their own stages.
- **Packets:** starter packet, buying with Career money, opening, the pity
  packet. Contents decided and saved at purchase.
- **Cards:** the hub card's shape, made nicer and collectable, with cool
  placeholder art (owner: "have fun"). Common cream, Uncommon green, Rare
  blue, Legendary yellow.
- **Save:** packets and the starter marker go inside `felt.career`, like
  the cards.
- **Checks per stage:** acceptance checks first, a separate review agent,
  `npm test`, the whole loop on emulated iPhones (three sizes) with
  reloads. Commit and push after every stage; a blocker is written down
  and the run moves on.

### Provisional numbers (the owner's to change; not simulated yet)

House-funded, 1,000-chip stacks unless noted. Skill on the 0-100 dial.

| Event | Rarity | Players | Length | Prizes | Notes |
|---|---|---|---|---|---|
| Back Room | Common | 3 | 10 hands | $60 / $30 / $15 | skill 20 |
| Full House | Common | 6 | 10 hands | $90 / $45 / $25 | skill 20 |
| Closing Time | Common | 4 | 20 hands | $120 / $60 / $30 | blinds up every 10, skill 25 |
| Face to Face | Common | 2 | 10 hands | $50 / $20 | skill 20 |
| Deep Pockets | Common | 4 | 10 hands | $80 / $40 | 2,000-chip stacks, skill 25 |
| Sponsored Night | Uncommon | 4 | 10 hands | $150 / $75 / $40 | skill 30 |
| Last Stack Wins | Uncommon | 4 | 10 hands | $200 | skill 30 |
| The Private Game | Rare | 4 | 20 hands | $400 / $200 | blinds up every 10, skill 40 |
| Final Table | Rare | 6 | elimination | $500 / $250 / $120 | 600 chips, blinds every 6, skill 40 |
| The Golden Ticket | Legendary | 3 | 10 hands | $2,000 | skill 45 |

Packets: **House Packet $150, four cards** (three Commons, one Uncommon or
better: Uncommon 78%, Rare 20%, Legendary 2%). **Starter** (free, once):
Back Room, Face to Face, Closing Time and one Uncommon. **Pity packet**
(three random Commons): given when you hold no cards, no unopened packet,
no event in progress, and less than the cheapest packet; holding it ends
the shortfall, so it can't be given twice for one.
