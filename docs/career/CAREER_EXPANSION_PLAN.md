# Up the Stakes: the Career expansion plan

Written 20 October 2026 against live `main` (v0.71.0). **Status: proposal,
awaiting the owner.** Nothing here is approved or built. It replaces the
"forward plan" questions left open in `INVITATIONS_PLAN.md` (Stages 6-7)
once the owner signs it off.

It starts from an outside design review (ChatGPT, "Career Expansion Design
Review", 19 Oct 2026, supplied by the owner, not in the repo), rates it,
reviews its own first draft, and ends in one plan.

---

## 1. Where the new Career actually is (verified 20 Oct)

- Ten invitation events, all No-limit Hold'em (`js/04-modes-and-scoring.js`):
  5 Common, 2 Uncommon, 2 Rare, 1 Legendary. Three packets: House ($150,
  three Commons + a fourth card 78/20/2 Uncommon/Rare/Legendary), Starter,
  Pity. Rarity never multiplies a prize.
- Every card already carries a **roster**: the opponents drawn for it when
  the packet is opened (`js/event-cards.js`). Who you'll sit with is part
  of the card today.
- The album, the tray, the event clock, chip bonus, duels and the result
  stage are live and signed off.
- The simulated economy (`invitation-economy.js`, 13 Oct): a House Packet
  returns **1.4-1.8x its price**; after 100 events the best simulated
  player has under twice the weakest's bankroll; rock bottom almost never
  happens; Last Stack Wins (an Uncommon) is worth less than a Common.
- The opponents **don't know about a hand limit** (`03-opponents.js` never
  reads it): nobody sits on a lead or shoves late in desperation.
- `CAREER_DESIGN.md`'s permanent rules: one currency (bankroll); no XP,
  levels, perks, power-ups; records are earned, never bought; money may
  buy entries, cash play and cosmetics, never poker power; no axis may
  strand a player.

**The real problem, in one line:** the loop has no *goal*, no *risk* and
no *reason to choose*. Money only goes up, there's one thing to spend it
on, and whichever card you play, it's the same game.

---

## 2. The outside review, assessed

### Score: 6 / 10

As research and risk discipline it's an 8. As a plan to make Career more
engaging it's a 5. Averaged and weighted to what you asked for: **6**.

### What it gets right

- **Truthful poker.** Real variants with their real rules, the rule traps
  named (Pineapple's discard timing, Omaha's exact-two, Short Deck's
  rankings), and "don't share an implementation between two different
  rules".
- **It kills filler.** Rejects table clones, random multipliers, Pair
  Pressure, The Bubble, Grand Invitational. Correct calls.
- **Hold'em formats before new poker families** (its Gate 2). Right order.
- **The Qualifier** (an event whose prize is a card) is the best single
  idea in it: it makes cards pay in cards, which is what turns a pile of
  invitations into a collection with momentum.
- **Album states** (discovered / played / conquered) and "P.I.P. not
  trained for this table" are honest and cheap.
- It respects your rules: one currency, no power, no framework, no
  redesign of the dashboard.

### What it gets wrong

1. **It's a content catalogue, not a progression design.** 26 events and
   8 packets answer "what's in the box", not "why do I want the next
   box". None of section 1's problem is solved by more events: with no
   goal and no risk, a 26th event is just more of the same loop.
2. **The cost is badly under-called.** Seven new poker families (Draw,
   PLO, Pineapple, Short Deck, Hi/Lo, Fusion, Stud), each with its own
   deck, deal, streets, betting structure, evaluator, AI, coach and
   portrait layout. The dashboard is built around two hole cards. Done
   well, that's roughly 15-20 releases (about two months at this
   project's pace), most of it opponent AI and phone layout, hiding
   behind "Gate 4, Gate 5".
3. **It rates the cheapest variant as expensive.** Short Deck needs no new
   dealing, streets or UI: a 36-card deck, a re-ranked evaluator and the
   AI's preflop table regenerated. It's the *cheapest* real variant, not
   "H".
4. **Eight packets with no content behind them.** It says so itself, then
   designs them anyway. A shelf you can't buy from is a broken promise on
   the machine.
5. **Characters are missing.** Your design's first game principle is
   "opponents should feel like characters". The review's only use of them
   is the Gauntlet. The card's roster, which already exists, is ignored.
6. **Gate 1 front-loads a big abstraction** (a full "game-format
   adapter" for deck, streets, actions, evaluator, visibility, AI, coach,
   showdown, save) before one variant exists. Build the first variant,
   then pull out the contract it actually needed.
7. **No session shape.** Nothing about what a 20-minute sitting feels
   like, or why you open the app tomorrow.
8. **Small errors:** Face to Face already has rising blinds (every 4
   hands); "Devil's Table" rotating modifiers is the random-chaos card it
   rejected elsewhere; Seven-Card Stud in portrait (seven cards per seat,
   four face up, six seats) is a no on a phone, not a "conditional".

### What you'd likely dislike as a player

- Waiting a year for the catalogue to feel different.
- Opening a packet of Omaha you haven't learned, with P.I.P. switched off.
- Eight slots, half dark.
- Still winning money with nothing to want.

---

## 3. My first draft, and its review

My first pass added: a stakes ladder of floors, buy-in "seat" cards,
rebuy events, cash-game cards, a finale, rivals, set rewards, card
expiry, and five variants. Reviewed the same way:

| Idea | Verdict | Why |
|---|---|---|
| A finale to save for (The Big Game) | **Keep** | The one thing money is missing: a goal you can see from the first day |
| Stakes floors (House, Club, High Roller) | **Keep, trimmed to three** | A ladder of packets is the "packet tiers" already recommended; a fourth floor is padding |
| Seat cards (the card is permission, your bankroll is the buy-in) | **Keep** | Puts money at risk with no new mechanics: entry-funded events already exist from the classic Career |
| Rebuy nights (buy chips back from your bankroll) | **Cut for now** | Edges toward "money buys poker power"; revisit only if Seat cards aren't enough risk |
| Cash-game cards | **Park** | Rewards skill best, but becomes the grind that makes packets pointless; it's the classic Career's Back Room again |
| Card expiry ("tonight only") | **Cut** | Punishes people who play less often; mobile-game pressure you said you don't want |
| Rivals with relationship counters | **Shrink** | Phase 7 is parked by you. Keep only the cheap, honest part: the *Rematch* card (below) and a recorded nemesis |
| Album set rewards | **Keep** | Cheap, collection-driven, cosmetic or one-off prize only |
| Five variants | **Trim to four, in cost order** | Short Deck, Pineapple, Draw, then PLO; everything else parked |
| Floor difficulty via AI skill | **Keep, with a warning** | The sim says AI skill 20 vs 70 barely shows. Floors only feel harder if the AI's top end really is better: measure first |

What survived is the plan below.

---

## 4. The plan: Up the Stakes

### The pitch

You start at the House. The machine has a marquee on top that you can see
from day one: **THE BIG GAME**, a buy-in table against the house's best
faces. Everything in Career is the climb toward that seat: better packets,
bigger tables, harder faces, stranger games, and a bankroll that can now
go down as well as up.

### Five pillars

**1. A goal: THE BIG GAME.** A permanent marquee on the hub. Not in any
packet. A Seat event with a large buy-in from your bankroll (price set by
simulation so a decent player reaches it in roughly 8-12 hours; your
call). Lose and the money's gone; you can save up and sit again. Win and
your name goes on the machine: a gold plate on the hub, the Golden
cabinet finish in the Workshop, and the Career's ending credits. After
that the machine keeps running (the album, the floors, the Big Game again
for a bigger plate). One currency, one goal, no XP.

**2. Risk: money can fall.** Two changes:
- **Repriced packets.** The House Packet should be close to break-even
  for an average player and profitable for a good one, not 1.5x for
  everyone. The simulator sets the numbers; you approve them.
- **Seat cards.** Some invitations are a seat, not a free entry: the card
  lets you in, your bankroll pays the buy-in, the prizes are the entries
  plus the house's overlay. The higher floors are mostly Seats. This is
  where good play gets paid and bad nights hurt.

**3. A ladder: three floors.** Each floor is a packet on the machine and
its own card pool:

| Floor | Packet | Who sits there | What's new there |
|---|---|---|---|
| THE HOUSE | House Packet (live) | the regulars, skill 20-30 | free invitations, the formats you know, Knockout events |
| THE CLUB | Club Packet | sharper faces, skill 40-50 | first Seat cards, Bounty and Mystery Bounty, the first odd games (Short Deck, Pineapple) |
| HIGH ROLLER | High Roller Packet | the house's best, skill 60-70 | Seats with real buy-ins, the Gauntlet, Omaha, the mixed game |

A floor's packet appears on the machine when you first *conquer* (win) a
Rare at the floor below. That's a record you earned, not something you
bought, and it never strands you: the House is always open. This also
fixes the eight-dark-slots problem: the machine shows three packets, and
a slot lights when its floor opens.

**4. Variety: formats first, then new games.** Hold'em formats are cheap
and change your decisions; new poker families are expensive and change
everything. So, in this order:
- *Formats* (Hold'em engine, new rules around it): Bounty Night, The
  Qualifier, Survivor's Cut, Bomb Pot Night, Mystery Bounty, The Gauntlet.
- *New games* (one at a time, each a release of its own): Six Plus (Short
  Deck), Crazy Pineapple, Kitchen Table Draw (Five-Card Draw), Omaha Club
  (Pot-limit Omaha). Each opens its own album page with a one-screen
  "how this game works" card the first time you inspect it.
- *Parked*: Omaha Hi/Lo, Seven-Card Stud, the Fusion-like Fourth Card,
  double boards, Razz/2-7/Badugi, Devil's Table.

**5. Faces that remember.** Cheap, honest, not Phase 7:
- The roster shows on the card front, not just inspect: you choose a
  card partly by who's sitting there.
- **The Rematch.** When a face knocks you out of a Rare or better, they
  occasionally appear in a later packet on a Rematch card: same face,
  heads-up, their line on the card ("Back for more?"). Beating them
  stamps their portrait in the album's *Faces* page.
- The album's Faces page records each face: met, beaten, beaten you.
  Records only, never bonuses.
- Sparse table talk gets two new triggers: a Rematch opener, and the Big
  Game.

*(This touches parked Phase 7 lightly. It needs your yes.)*

### Collection

- Album states: **SEEN** (you've held it), **PLAYED**, **CONQUERED** (won:
  the card gets a stamp and a foil edge in the album). Records survive the
  card being played.
- **Sets**: each album page is a set (the House page, the Knockout page,
  the Odd Games page...). Conquering every event on a page pays a one-time
  house prize and a cosmetic (a felt, a card back, a cabinet finish in the
  Workshop). Never power.
- **The Qualifier** pays a specific, pre-drawn card from the floor above,
  decided when the Qualifier's packet is opened and saved then, so a
  reload never rerolls it. This is the cheapest way to see a higher floor
  early.

### The catalogue: 22 cards by the end, not 26

Live events keep their terms unless marked. **New** = proposed.

| Floor | Rarity | Card | Format | Note |
|---|---|---|---|---|
| House | C | Back Room | 3 players, 10 hands | live |
| House | C | Full House | 6 players, 10 hands | live |
| House | C | Closing Time | 4 players, 20 hands | live |
| House | C | Face to Face | heads-up knockout | live |
| House | C | Deep Pockets | deep stacks, 10 hands | live; least distinct, candidate to become Survivor's Cut later |
| House | C | **Survivor's Cut** | 6 players; ends at 3 left or 16 hands; the 3 survivors paid flat | New: *survive*, don't chip up |
| House | UC | Sponsored Night | 4 players, 10 hands | live |
| House | UC | Last Stack Wins | 4-player knockout, winner takes all | live; **reprice**: it's worth less than a Common today |
| House | UC | **Bounty Night** | 5-player knockout, cash per knockout + places | New |
| House | UC | **The Qualifier** | 4 players, 10 hands; 1st wins a Club card | New |
| House | R | The Private Game | 4 players, 20 hands | live |
| House | R | Final Table | 6-player elimination | live |
| House | L | The Golden Ticket | 3 players, 10 hands, winner takes all | live |
| Club | UC | **Bomb Pot Night** | every 3rd hand, everyone antes and plays from the flop (announced) | New |
| Club | UC | **Six Plus** | Short Deck, 4 players | New game |
| Club | UC | **Crazy Pineapple** | 3 hole cards, discard after the flop betting | New game |
| Club | C | **Kitchen Table Draw** | Five-Card Draw, 3 players | New game |
| Club | R | **Mystery Bounty** | Seat; 5-player knockout; sealed bounty envelopes opened on the knockout | New: the machine's best physical reveal |
| Club | R | **Rematch** | Seat; heads-up against the face who beat you | New |
| High Roller | R | **Omaha Club** | Pot-limit Omaha, 4 players | New game |
| High Roller | L | **The Gauntlet** | three heads-up duels in a row, harder each time | New |
| High Roller | L | **House Special** | Seat; mixed game: Hold'em, Draw, Omaha, 5 hands each | New, last |
| Marquee | - | **THE BIG GAME** | Seat; big buy-in; the house's best | New: the goal |

Dropped from the outside review: Omaha Eight, Open Secrets, The Fourth
Card, The Old Guard (Stud), Devil's Table. Open Secrets is the best of
those (one hole card face up: a clever information game with no new
dealing); it's first in line if the catalogue needs one more.

### The packets: three, plus the two free ones

| Packet | Opens | Contents (odds by simulation) |
|---|---|---|
| House | always | as now, repriced |
| Club | conquer a House Rare | Club and House cards; Seats; the first new games |
| High Roller | conquer a Club Rare | High Roller and Club cards; mostly Seats; Legendaries likelier |
| Starter, Pity | as now | unchanged |

Targeted packets (Knockout Box, Oddities, Omaha Club) wait until each has
at least five distinct cards behind it.

---

## 5. Releases

Each release is one branch, one pull request, `npm test` and the browser
checks green, played by you on the phone before the next starts.

| # | Release | What you get | Size |
|---|---|---|---|
| R1 | **Stakes** | The AI knows the hand limit (sits on leads, shoves late); repriced House Packet and Last Stack Wins; album SEEN / PLAYED / CONQUERED stamps; THE BIG GAME marquee on the hub (visible, priced, not yet playable) | M |
| R2 | **Knockouts** | Bounty Night, Survivor's Cut, The Qualifier (pays a pre-drawn card); knockout credit, split bounties, payout-once tests | M |
| R3 | **The Club** | Seat cards (bankroll buy-ins), the Club floor and packet, Mystery Bounty, Bomb Pot Night, the Faces page and Rematch (if approved); THE BIG GAME playable | L |
| R4 | **Six Plus** | Short Deck: the first new game and the first `variant` field on an event; Hold'em proven untouched by regression tests | M |
| R5 | **Crazy Pineapple** | three hole cards and a discard on the dashboard; the variant contract written down from what R4 and R5 actually needed | M-L |
| R6 | **Kitchen Table Draw** | Five-Card Draw: no board, a draw street, the AI's exchange choices | L |
| R7 | **High Roller** | Pot-limit betting, Omaha Club, the High Roller floor and packet, The Gauntlet | XL |
| R8 | **House Special** | the mixed game, only once Draw and Omaha are solid | M |

R1-R3 make Career feel like a different game using only the poker you
already have. R4 onward adds new poker one game at a time; you can stop
after any of them and the Career is complete.

### Rules for every release

- Normal Hold'em is never changed by a variant: every variant ships with
  regression tests proving the Hold'em deal, evaluator and AI are
  byte-for-byte what they were.
- P.I.P. either gives honest advice for a game or says "P.I.P. not
  trained for this table" and turns its hand report off.
- Prizes, prices and odds come from `invitation-economy.js` (reworked in
  R1 to model the floors, Seats and the Big Game) and are approved by you
  before shipping.
- Old saves keep working: new fields default safely; a card bought before
  a change keeps its snapshot terms.
- Every new part on screen goes through the Pattern Book first; every
  visual is shown to you as a phone-first lab link before it's in the game.

### Acceptance checks worth naming now

- AI: with N hands left and a lead, the leader's VPIP drops; trailing by
  a lot with 1-2 hands left, shove frequency rises (measured by
  `event-sim.js`).
- Economy (R1): average player's House Packet ROI between 0.95 and 1.10x;
  skill 70 ends 100 events at least 2.5x skill 20's median; a bust-out to
  the pity packet happens to a weak player in at least 1 Career in 5.
- Knockouts: bounties in split pots and simultaneous knockouts credited
  exactly once; total paid never exceeds the event's cap.
- Qualifier: the prize card is decided once and survives reload, abandon
  and the opening animation.
- Seats: buy-in taken in the same save write as the event's start; an
  abandoned Seat is a loss, never a refund-by-reload.
- Short Deck: A-6-7-8-9 straight, flush beats full house, 36-card deck,
  hand names and P.I.P. right.
- Pineapple: the discard happens after flop betting, all-in players
  discard too, discarded cards never come back.

---

## 6. Decisions for you

1. **The goal.** THE BIG GAME as the Career's finale, with credits and a
   gold plate, and the machine carrying on after? Or no ending at all?
2. **Risk.** Is it right that a House Packet stops being a sure profit,
   and that Seat cards can lose you real bankroll?
3. **Floors.** Three floors, the next opening when you win a Rare below?
   Or opened by bankroll alone?
4. **Faces.** The Rematch card and the album's Faces page (a light touch
   on parked Phase 7)? Yes, no, or later?
5. **New games.** Short Deck first (cheapest), then Pineapple, Draw,
   Omaha? Or a different first game?
6. **Classic Career.** Retire it once R3 ships (the Club's Seats cover
   what it did)?
7. **Start.** R1 as the first build?
