# Invitations: Career as packets of event invitations (plan)

Written 12 October 2026 with the owner. Status: **Stages 1-7 live** (the new Career is the default Career since v0.69.0; the polish pass, v0.70.0; the event clock, duels and the curated tray, v0.71.0). Nothing here is decided beyond what it says the
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

## Stage 3: packets (overnight run)

**The save:** `career.packets` (unopened packets: kind, the cards inside,
when) and `career.starterGiven`, inside `felt.career`; additive, no
version change.

### Acceptance checks

1. A save without packets loads unchanged and isn't rewritten.
2. Buying takes exactly the price and stores the packet with its cards in
   **one** write; refused (nothing changes) when the money is short.
3. A packet's cards are decided at purchase: a reload before opening
   finds the same cards; opening moves them into your cards in one write
   and the packet is gone; it can't be opened twice.
4. A House Packet holds three Commons and one Uncommon or better, each a
   real invitation event of that rarity.
5. The starter packet is given once per Career, never again (reloads,
   visits).
6. The pity packet is given only when you hold no cards, no unopened
   packet, have no event or cash table open and less than the cheapest
   packet; it is never given twice for one shortfall (repeat visits,
   reloads); a new shortfall later gets a new one.
7. Damaged packets are dropped on load without touching the rest.
8. Preview/DEV only; `npm test` green.

## Stage 7: the event clock, duels and the curated tray (owner, 13 Oct 2026; v0.71.0)

The owner played v0.70.0: the HAND counter sat on the face at 2 and 6
players (it was only ever checked at 3 and 4: hence
`validation/tools/table-sweep.js`, every invitation at three phone
sizes, which fails on any overlap), and head-to-head felt like a death
march (a big loss with four hands left decided it).

- **The event clock** (`js/event-clock.js`, Pattern Book "Event clock",
  awaiting sign-off): HAND n/N, or the time played in a knock-out; finds
  the clear spot nearest the gap between the seats and the board, and
  moves off anything that arrives under it; pick it up, put it anywhere,
  flick it; its place kept in `settings.eventClock`.
- **The death march, measured** (`event-sim.js`'s new "leader@-3 holds"
  and "comeback" columns). Back Room as it was: the leader with three
  hands to go won 79%, you came back from behind 8%. With the blinds up
  every 3 hands: 64% and 16%. So hand-count events now raise the blinds
  (every 3 hands; every 5 in the 20-hand ones), and pay a **chip bonus**
  on top of the place (owner's choice: place + chips): $1 per 100 chips
  you finish with ($1 per 200 in Deep Pockets). A snapshot started before
  keeps its old terms (no `chipBonus`, no bonus).
- **Duels:** Face to Face is a winner-takes-all knock-out ($60; 2,000
  chips, blinds every 4 hands: about 18 hands); Last Stack Wins is a
  four-player knock-out ($200; blinds every 4: about 20 hands).
- **The curated tray** (owner): `career.tray` ([{ id, x }], at most 12,
  only cards you own; a played card leaves it in the same write). Half
  or more over the tray when let go: kept. REDEAL deals three onto the
  felt (taking back the three it dealt before, if untouched). A double tap
  clears the felt, not the tray. A card carried off the album's book
  lands on the felt (`CareerMain.adopt`); the album marks an event whose
  cards are all on the table.
- **The economy after** (`invitation-economy.js --events 300`): a House
  Packet now returns $211 / $237 / $264 at skills 20 / 40 / 70 (was $183
  / $200 / $219); after 100 events the median bankroll is $1,967 /
  $2,692 / $3,309 (was $1,285 / $1,715 / $2,175). Good play is paid more,
  and money grows faster: the goal (what money is for) is still the
  forward plan's first decision.
- Checked: `npm test`; the browser checks (now also the table sweep and
  `tray-scenario.js`); `new-career-lab.html` for the owner's phone (link:
  https://claude.ai/artifact/U1TtQZDgtw1ZkdapNkwLyy). Signed off by the
  owner (13 Oct); the lab is archived (restore from commit c169377).

## Stage 6: the polish pass (owner, 13 Oct 2026; v0.70.0)

The owner's audit list (A-F), approved in one go:

- **A. Quick fixes.** The hub clears the iPhone status bar (`--safe-top`),
  and so do the table's top seats and the inspect screen's back key.
  P.I.P. gets out of the way of a result card, and no longer says "the
  run over" when you're knocked out of an event.
- **B. One motion language.** The hub is a screen of its own (`#hub`), so
  every screen change turns the game's drum: menu ↔ hub, hub ↔ shop (the
  shop's own drum is gone: it's the shared engine, on part of the
  screen), hub → table, table → hub. The album keeps its throw: screens
  roll, objects land.
- **C. The end of an event.** Every invitation finish turns the full
  result stage (a paid bust keeps the K.O. beat): EVENT WON / CASHED /
  EVENT LOST, the prize, the finish (`=2ND` when shared, "place shared, prizes
  split"), OUTLASTED (players actually knocked out), the top prize; no
  buy-in, no events board. Back at the hub the feeder's plate says how it
  went (`3RD · +$15`). ABANDON EVENT under the hub's MORE key gives up an
  event in progress (the game's own confirmation).
- **D. Packets.** The starter (green, STARTER EDITION) and the rock-bottom
  packet (faded, battered, ON THE HOUSE, three cards) have their own
  wrappers; the shop's lamps say the fourth card is a maybe, not a
  certain Uncommon. The catalogue's size, the special-rules events and the
  owner's art wait for the owner (the forward plan).
- **E. The economy, simulated:** `validation/tools/invitation-economy.js`
  (results below). Prices are not changed here.
- **F. Housekeeping.** The lab controls no longer reach the game (the hub's
  TUNE key opened the album's lab sheet: it's MORE now, with how to play,
  ABANDON and START OVER); stale docs corrected; the CRT and pack labs and
  the `packet-machine/` copy archived; the two classic scenarios pin the
  classic Career; the browser suites run on GitHub.

### The economy, simulated (13 Oct 2026)

`node validation/tools/invitation-economy.js --events 300` (each event
played 300 times by the game's AI at skills 20, 40 and 70; 2,000 whole
Careers each). Average prize per event, and how often it pays:

| Event | Rarity | Skill 20 | Skill 40 | Skill 70 |
|---|---|---|---|---|
| Back Room | C | $34, 100% | $37, 100% | $36, 100% |
| Full House | C | $23, 50% | $30, 59% | $31, 65% |
| Closing Time | C | $50, 77% | $53, 79% | $66, 90% |
| Face to Face | C | $35, 100% | $37, 100% | $39, 100% |
| Deep Pockets | C | $30, 51% | $33, 56% | $35, 61% |
| Sponsored Night | UC | $66, 80% | $69, 82% | $75, 87% |
| Last Stack Wins | UC | $47, 24% | $40, 20% | $43, 21% |
| The Private Game | R | $136, 45% | $147, 53% | $163, 58% |
| Final Table | R | $98, 38% | $165, 58% | $197, 66% |
| The Golden Ticket | L | $580, 29% | $610, 31% | $647, 32% |

A packet's worth (its cards' average prizes): House ($150) $183 / $200 /
$219; starter $176-200; pity $103-124. Whole Careers, median bankroll
(10th-90th percentile) after 100 events (about 1,200 hands): skill 20
$1,285 ($570-2,900), skill 40 $1,715 ($910-3,400), skill 70 $2,175
($1,375-3,735); a pity packet in well under 1 Career in 10.

What it says:
- **A House Packet pays back 1.2-1.5 times its price**, so the bankroll
  creeps up (about $8-17 an event) and never falls for long: no money
  machine, but no pressure either. There is nothing else to spend on.
- **Skill barely shows**: the best player ends 100 events with under twice
  what the weakest does. Events are short (10 hands) and most pay most
  places, so luck dominates.
- **Last Stack Wins (Uncommon) is worth less than three Commons** (winner
  takes all, 4 players): an Uncommon that's a downgrade. Closing Time
  (Common, 20 hands) out-earns it.
- **Rock bottom almost never happens**: Back Room and Face to Face pay
  every place, so even a losing player keeps buying.
- Not changed here: the prices are the owner's call, with the goal (the
  forward plan) deciding what money is for.

## Stage 5: the new Career in the game (owner, 13 Oct 2026; v0.69.0)

The owner wanted to test it in the real app: Career on the menu opens the
hub. Settings → Career picks NEW (the default) or CLASSIC; the new Career
starts fresh on its own save (`felt.career.new`, owner's choice), so the
classic Career, its bankroll and venues are kept for when it's switched
back. `js/career-link.js` loads the hub only on NEW. The preview lab and
the `new-career/` home-screen copy (v0.68.0) are retired.

Checked: `new-career-scenario.js` plays the whole loop in `index.html`
(menu → Career → hub → … → back to the menu, a planted classic save
untouched); `npm test`; the play-test; a CLASSIC load (old Career screen,
no hub parts loaded) and the Settings switch both ways.

## Stage 4: New Career (preview) (overnight run, 13 Oct 2026; retired by Stage 5)

`career-preview-lab.html` (link: https://claude.ai/artifact/Un9apWuFRzV7TDArv9yp7A):
the real game, booting into the hub, with the shop, the opening and the
album on a real Career save of its own (kept across reloads, never the
game's). The connector is `js/career-link.js`; the labs use it only when
it's there.

### Acceptance checks

1. A fresh Career: $500 and the starter packet, once.
2. Opening a packet saves its cards as yours; it can't be opened twice.
3. REDEAL deals only cards you own.
4. PLAY uses the card up as its event starts at the real table.
5. Back at the hub, the prize is credited once and the reel agrees.
6. The shop buys a House Packet with the bankroll, saved with its cards.
7. A reload keeps everything.
8. The album shows what you hold.
9. Broke and cardless: one pity packet, never two.
10. No JavaScript errors; the labs still pass their own checks; the live
    game unchanged for players (`npm test`, the play-test).

### Results (13 Oct 2026)

- `validation/tools/new-career-scenario.js`, real touch: all eleven steps
  pass at 390x844 (full motion), 375x667 and 430x932 (reduced motion),
  and against the staged bundle as published.
- `npm test` 25 of 25; the play-test passes (320x700, 390x844, 430x932);
  the shop lab's and the opening lab's own checks pass (three sizes each).
- Independent reviews: Stage 3 (nothing blocking; three minor fixed) and
  Stage 4 (two blocking found and fixed: lab money in the shop, a stuck
  shop if the save refused an opening; minor ones fixed). A review of the
  fixes themselves was not run.
- Not done: the owner playing it; hand timing on a real phone; the
  economy simulated; the Pattern Book sign-off for the new parts.

### Owner answers (13 Oct 2026)

- **Pity packet:** it may come back after every shortfall. No game over
  screen: being broke is rock bottom, and the house deals you back in.
- **Buying during an event left in progress** is fine.

### Still open

- Prices, prizes and packet odds are the provisional ones above.
