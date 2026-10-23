# Event Expansion V1

Written 23 October 2026 against `main` at v0.71.0. **Status: proposal,
awaiting the owner's approval of the shortlist and the first milestone.
No production code changes until then.**

This answers the owner's brief "Let's Start Building Career Variety"
(23 Oct). It replaces the immediate roadmap in
[`MEGA_PLAN.md`](MEGA_PLAN.md) (Section 9). The Mega Plan's architecture
(one small rules module) and economic principles still apply. Its Big
Game, floors and larger packet shelf continue alongside this work, but
they don't block it. **The Ringer is removed**, at the owner's request.

---

## A. New ideas

### The owner's three, assessed and improved

#### THREE STRIKES: strong, with one fix

**Proposed:** lose a pot at showdown, take a strike; three strikes and
you're out, whatever your stack.

**Assessment.** This is the best of the three. It changes *who* you want
to call:

- **Calling becomes dangerous; betting doesn't.** A bet that isn't called
  never reaches showdown, so it can't earn a strike. The event rewards
  aggression, and bluffing gets better.
- **A player on two strikes can be bullied.** They can't afford to call,
  so they're a target. Everyone at the table can see it. That's a lovely
  piece of emergent strategy.
- **Big stacks are mortal.** A chip leader on two strikes has to be
  careful.
- **Characters show.** Mavis, the calling station, will strike out
  quickly. Tony will collect strikes and not care.

**The fold-everything problem.** A player who folds every hand never gets
a strike. If striking out were the only way to lose, the most cautious
player would outlast everyone. The fix is the event's end condition:

- **The event ends after 15 hands, and survivors are placed by chips.**
  Blinds rise every 3 hands, so a player who folds everything bleeds
  chips and finishes last of the survivors.
- A struck-out player is ranked **below every survivor**: three strikes
  is a real disaster.
- A simulated "nit" test player must not finish better on average than
  the normal player. If it does, a reserve rule is ready: **fold five
  hands in a row before the flop and you're stamped CHICKEN**, which
  counts as a strike. (Funny, but a second rule, so only if needed.)

**Rules:**
- Five players, 1,000 chips, blinds up every 3 hands, 15 hands.
- If you reach a showdown and win nothing, you take a strike. A split pot
  counts as a win, so no strike. If several players lose one showdown,
  each takes a strike.
- On your third strike you're out at the end of that hand, **chips and
  all**. Your chips go back to the house; they aren't shared out.
- The event ends after hand 15 or when one player is left. Survivors are
  placed by chips; struck-out and busted players are placed below them,
  later exits above earlier ones. Top three paid, plus the chip bonus.

**AI:** calls tighter as its own strikes rise; bluffs more into players
on two strikes. Both use public information only.

**Look:** three empty boxes under each portrait on the seat card. A red
rubber stamp thumps an **X** into the next box. On a third strike a
game-show buzzer sounds, a big red X stamps across the whole portrait,
and the seat card slides off the rail (the existing K.O. exit) while
its chips are swept into a house drawer. Your own three strike lamps sit
in the console beside your bank.

**Difficulty:** medium. A between-hands removal with chips (also needed
by The Trapdoor), strike state, AI hints.

#### NO FREE RIDES: good, but only with a real minimum bet

**Proposed:** nobody may check; bet or fold instead.

**Assessment.** As written, it collapses into something dull: every
"check" becomes a minimum bet of one big blind. Pots creep up by small
bets nobody reads anything into, and everyone calls them. To be
entertaining the bet has to *hurt*:

- **Rule:** from the flop onwards, if nobody has bet, you may not check.
  **Bet at least half the pot, or fold.**
- **Preflop is unchanged.** The blinds are already bets, and forcing the
  big blind to raise or fold their own option would just be confusing.
- **Short stacks** may bet everything they have, even if it's less than
  half the pot.
- **Nobody bets into nobody.** If only one player can still act (the rest
  are all-in), the cards are just dealt, as now.

**What it does to the poker:**
- Out of position with nothing, you must bluff or give up. **Position
  becomes everything**, which is real poker, exaggerated.
- Draws have to pay to see cards, and pots balloon. Hands are short and
  loud.
- Folding when nobody has bet is allowed, and sometimes right. It looks
  funny and it is funny.

**Awkward bits found in the code:**
- When a player's time runs out, the engine's automatic move is
  "check" (`05-game-engine.js`); it has to become "fold" here.
- **P.I.P. recommends checks.** Under this rule its advice must turn
  "check" into "fold, or bet half the pot", truthfully. Its equity model
  can do that; the wording and recommendation path need changing.
- The AI must decide between a forced half-pot bet and folding: a real
  change in its post-flop logic, using its existing equity estimate,
  position and personality (Tony bets; Nigel folds).

**Look:** when the flop lands, a heavy enamel sign reading **NO
CHECKING** drops from the top of the screen on two chains and slams into
a slot at the board's edge with a puff of felt dust. On the action drum,
the CHECK key gets a riveted red **VOID** plate. Sound: a chain rattle
and a clang.

**Difficulty:** medium. A legal-actions hook in the engine (shared with
High Noon), AI changes, P.I.P. wording.

#### POT MONSTER: the weakest of the three as proposed, rescued by a redesign

**Proposed:** win a large enough pot and the monster celebrates and pays
a bonus.

**Assessment.** As written it barely changes a decision. Big pots happen
when two good hands meet, and that's already good poker. It's another
"win a big pot, get a bonus" meter, with a great creature attached. And a
large bonus *would* encourage silly over-betting.

**The redesign: a carnival strength-tester with a visible target.**

- **Rule:** before each hand the Pot Monster shows its **appetite**: a
  number of big blinds (drawn for the hand and saved before it's shown;
  between 15 and 40 BB). **If the pot reaches the appetite, the monster
  is fed: the winner gets a treat of chips** from the monster's belly
  (half the appetite). After **three meals** it falls asleep for the
  rest of the event.
- **Why that's a real decision:** you can see the line. With a strong
  hand, do you size your bet to push the pot past it? With a draw, the
  treat improves your pot odds, so you call a little wider, and that's
  correct poker, not irrational.
- **No collusion:** the AI wants chips like any player; the treat is just
  part of the pot it's playing for. It sizes value bets towards the line
  and counts the treat in its pot odds. It never builds a pot with another
  player on purpose.
- **Bounded:** three meals at most, so at most 60 BB of extra chips enter
  the event. That's checked by a test, and it reaches money only through
  the chip bonus.

**Look:** a squat brass creature beside the pot tray with a glass belly
and a strength-tester column up its back. As chips go in, the puck climbs
the column, the monster's eyes widen and its tongue lolls. When the pot
passes the line the bell rings, it chomps, burps, and spits the treat
onto the winner's stack. Asleep: it snores, with a little "Z" in pixel
type. Reduced motion: the bell and one frame.

**Difficulty:** medium. Appetite state, a treat paid between the pot and
the next hand, AI pot-odds and sizing hints, a creature with five or six
animation frames.

### My new ideas (twelve, five kept)

| Idea | Central rule | Why it's fun | Decisions | Difficulty | Visual potential | Verdict |
|---|---|---|---|---|---|---|
| **TONY'S BIRTHDAY** | Every opponent is a maniac. It's Tony's party, and his cousins have come | Pure chaos you can *read*: every pot is raised, everyone is bluffing | Tighten up, trap, let them hang themselves. Real poker against a known style | Easy: a roster and personality override, no new rule | Party hats on every portrait, confetti on big pots, a cake on the board's corner losing a slice per hand | **Shortlist** |
| **THE SPOTLIGHT** | Win a pot and you play the next hand with **one card face up** | A built-in comeback: the leader is handicapped in plain sight | Attack the spotlit player when their card is weak; respect it when it's an ace | Medium-hard: the AI must use the exposed card (its equity simulation fixes the known card) | A stage spotlight beam over the seat; the card flips up with a stage "ta-da" | **Shortlist (batch 2)** |
| **ROBIN HOOD** | Every 4 hands the chip leader pays 5 big blinds to the shortest stack | Keeps the table close; nobody runs away with it | Timing your lead; the short stack gambles less | Easy: a between-hands transfer | A little pixel archer fires an arrow that carries a chip stack across the felt | **Good (batch 3)** |
| **FLOP DROP** | Every hand everyone antes 2 big blinds and the flop is dealt straight away, with no preflop betting | Every hand is a real pot, chaos with cards | Pure post-flop poker; draws everywhere | Medium: needs the ante and a "skip preflop" rule | The flop slams down the moment the antes land | **Good (batch 3)**, with the ante |
| **THE CROWN** | A gold chip sits in one stack. Beat its holder in a pot and it's yours. Hold it at the end: a bonus | Capture the flag | Holder plays scared; everyone hunts them | Medium | A tiny crown hopping between seat cards | **Cut for now**: Hot Potato's passing mechanic in reverse. One of the two, not both |
| **PEEKABOO** | One of your hole cards stays face down, unseen even by you, until the flop | You play your first decision blind; very funny reveals | Preflop on one card | Medium-hard: the AI's equity needs an unknown own card | A "DON'T PEEK" sticker peeled off on the flop | **Later** |
| **DOUBLE TROUBLE** | Two boards; each pot splits between the best hand on each | Double the drama, frequent splits | Board coverage | Hard: two boards on a small screen, AI equity on both | Stacked boards | **Later** |
| **STICKY CHAIRS** | Folding costs a 1 BB fine | Loose, sticky table | Calling more | Easy | Glue on the chairs | **Cut**: punishes good folds; No Free Rides does aggression better |
| **SUIT OF THE NIGHT** | A suit drawn per hand pays a bonus if you win with it | | | Easy | | **Cut**: luck bonus with no decision |
| **MUSICAL CHAIRS** | Seats rotate every few hands | | | Easy | | **Cut**: position already rotates; no new decision |
| **SHOT CLOCK** | Decisions on a short timer | Panic | | Easy | | **Cut**: bad for accessibility, bad on a phone |
| **THE GREAT RESET** | Every 5 hands all stacks reset to equal | | | Easy | | **Cut**: undoes the poker you just played |

**Critical shortlist:** Tony's Birthday (cheap and characterful),
The Spotlight (the most interesting new rule), then Robin Hood and Flop
Drop for later batches. The Crown loses to Hot Potato: same mechanic,
less funny.

---

## B. The catalogue, ranked

Combined: the owner's three, my shortlist and the surviving Mega Plan
events. Ranked by how much fun they add for how little risk.

| Rank | Event | Kind · length · rarity | What it is | Batch |
|---|---|---|---|---|
| 1 | **Three Strikes** | Madhouse · Full · Uncommon | Lose a showdown, take a strike; three and you're out | **1** |
| 2 | **No Free Rides** | House Rules · Full · Uncommon | No checking: bet half the pot or fold | **1** |
| 3 | **Bounty Night** | House Rules · Long · Uncommon | Wanted posters; knock players out for cash | **1** |
| 4 | **The Trapdoor** | Madhouse · Full · Rare | Every 3 hands the smallest stack drops through the floor | **1** |
| 5 | **High Noon** | Straight · Quick · Common | Heads-up, all-in or fold only | **1** |
| 6 | **Tony's Birthday** | Straight · Full · Common | A table of maniacs in party hats | **1** |
| 7 | **Hot Potato** | Madhouse · Full · Uncommon | Win a pot to pass the bomb; the blast is a big ante | 2 |
| 8 | **Pot Monster** | Madhouse · Full · Uncommon | Push the pot past the line to feed it | 2 |
| 9 | **The Spotlight** | House Rules · Full · Rare | Win a pot, show a card next hand | 2 |
| 10 | **The Qualifier** | House Rules · Full · Uncommon | Win the card in the glass case | 2 |
| 11 | **The Contract** | House Rules · Long · Rare | Sign one contract on one named opponent | 3 |
| 12 | **The Executioner** | Madhouse · Long · Legendary | The boss: survive the Axe, bring him down | 3 |
| 13 | Robin Hood | House Rules · Full · Common | The leader pays the shortest stack | 3 |
| 14 | Flop Drop | House Rules · Quick · Uncommon | Antes and straight to the flop | 3 |
| 15 | The Heist | Madhouse · Full · Rare | Walk away with the loot, or play on | later |
| 16 | Bingo | House Rules · Full · Uncommon | A slip of poker objectives | later |
| 17 | The Gauntlet | Straight · Long · Legendary | Three duels in a row | later |

**Balance check of the whole list:**
- **Straightforward poker:** the existing ten (minus Deep Pockets and
  Sponsored Night from packets) plus Tony's Birthday.
- **Quick challenges:** High Noon, Back Room, Full House, Flop Drop.
- **Strange House Rules:** No Free Rides, Bounty Night, The Spotlight, The
  Qualifier, The Contract, Robin Hood.
- **Madhouse:** Three Strikes, The Trapdoor, Hot Potato, Pot Monster.
- **Longer tournaments:** Bounty Night, Final Table, Last Stack Wins.
- **Prestige encounters:** The Executioner, Golden Ticket; later The
  Gauntlet.

Prestige is the thin spot early. That's deliberate: a boss is the most
expensive thing here, and it's better built once the parts it reuses
exist.

---

## C. The first build: six events

| Order | Event | Rarity | Experience | Why it's in |
|---|---|---|---|---|
| 1 | **Three Strikes** | Uncommon | a new way to be eliminated | the owner's favourite and the strongest idea; builds the strike-stamp part and removal-with-chips, both reused |
| 2 | **No Free Rides** | Uncommon | a betting restriction | the purest "same poker, different table"; builds the legal-actions hook |
| 3 | **High Noon** | Common | a quick duel | uses the same hook; the only true Quick game; three minutes |
| 4 | **Bounty Night** | Uncommon | a longer tournament with rewards | knockout credit already exists; wanted posters |
| 5 | **Tony's Birthday** | Common | straight poker with character | almost no rules work, so effort goes into the party look; a breather between harder builds |
| 6 | **The Trapdoor** | Rare | the big physical moment | reuses Three Strikes' removal; the Rare that makes the first expansion feel special |

That's two Commons, three Uncommons and one Rare: quick, full and long;
straight, house rules and madhouse; three of the owner's ideas or
favourites, and one of mine.

**Why not Hot Potato or Pot Monster in the first six:** both need new
chips to enter the game (the blast ante; the monster's treat). The ante
is a change inside the poker engine, where side-pot bugs hide. They
start batch 2, with the ante built and tested on its own first.

---

## D. Collecting and packets

### The album: Discovered, Played, Won

Today the album shows **every** event in the catalogue, dimmed if you
hold no card for it. It keeps no record of what you've found, played or
won (`career-link.js`, `albumPages`). So there's nothing to discover and
nothing to complete. V1 fixes that first:

- **A small record per event** in the Career save
  (`career.album[eventId] = { found, played, won }`, dates only), inside
  the existing save, with no new saved key. It's written in the same save
  write as the thing it records: opening the packet, starting the event,
  settling it.
- **Undiscovered events show as a mystery slot**: the card back in the
  event's rarity colour with a question mark. You can see a Legendary is
  out there, but not what it is.
- **The first time a packet gives you an event**, its card is marked
  **NEW!** during the opening (a stamped ribbon on the card, a brighter
  chime), and its album slot fills in.
- **PLAYED:** a small punched hole in the slot's corner, like a used
  ticket.
- **WON:** a gold **CONQUERED** stamp across the slot. It stays forever,
  even after every card of that event is used up. Rarer wins get a
  grander stamp: a gold foil edge for Rare, an animated shimmer for
  Legendary. The result stage gets one extra beat: "CONQUERED. New in your
  album."
- **A page with every event won** gets a gilt border.
- **Old saves:** events on cards you hold count as found; if your last
  result was a win, that event counts as won. Anything older isn't known,
  so it starts unrecorded.

### Packets: a second (and third) choice early

The rule from the Mega Plan holds: **no packet advertises variety the
catalogue can't supply.** After the first six events there's enough for
two curated packets beside the general one.

| Packet (working name) | Curator | Contents | Pool when it opens |
|---|---|---|---|
| House Packet | the house | as now: a general mix | everything |
| **Tony's Party Bag** | Tony, the Maniac | chaos and aggression: three cards from Tony's pool, one from anywhere (rarity upgrade slot) | Three Strikes, No Free Rides, The Trapdoor, Tony's Birthday, Bounty Night, High Noon: **six events, Common to Rare** |
| **Nigel's Members' Club** | Nigel, the Rock | proper poker and tournaments: three from Nigel's pool, one from anywhere | Back Room, Full House, Closing Time, Face to Face, Last Stack Wins, The Private Game, Final Table: **seven events, Common to Rare** |

- **Both open together in milestone 6**, once The Trapdoor completes
  Tony's pool. Nigel's could open sooner (its pool exists today), but the
  shop gets one change, one sign-off and one round of pricing.
- **The mascot is on the packet**: the curator's face on the wrapper,
  and their line on the shop's tag ("Bring a helmet." / "Proper cards
  only, please."). The vending machine and the opening are reused as they
  are; only the wrapper art and the card draw change.
- **Equal value, different flavour:** each packet's average return is
  within 5% of the others at the reference player (simulated). You
  choose by mood, not by maths.
- **Discovery helps:** within a slot's rarity, an event you haven't found
  yet counts twice. Collecting stays lively without a "pity" timer.
- **Later packets** (a Quickfire bag, a prestige box) wait until their
  pools have six events.

### Pricing, kept light

No month-long economy project. For each new event:

1. Simulate it with the game's AI at skills 20, 40 and 70, and with the
   test players that try to break it (the nit, the maniac, and the
   event's own: the strike-dodger, the half-pot folder, the bounty
   hunter).
2. Its average money **per hand** must sit within 15% of the existing
   events of its rarity. No test player may beat the normal one.
3. Its **budget** (the most it can ever pay) is a number in the
   catalogue, checked by a test.

The House Packet's generosity (it returns 1.4-1.8× its price today)
stays as it is until milestone 6, where the three packets are priced
together, with the owner.

---

## E. Implementation

Each milestone is one branch and one pull request, `npm test` and the
browser checks green, a release, and the owner's phone sign-off before
the next starts. **An event is finished only when its card art, props,
animation, sound, inspect text and album record are done.**

| # | Milestone | Delivers | Depends on | Gate |
|---|---|---|---|---|
| **M1** | **The album and the rulebook** | Discovered / Played / Won; mystery slots; NEW! in the opening; CONQUERED stamps; the rules module with no rules yet (existing events take today's path); the kind glyph on cards | - | album lab link on the phone; old saves checked |
| **M2** | **Three Strikes** | the first new event, fully finished | M1 | strike stamp lab; nit test passes; owner plays it |
| **M3** | **No Free Rides + High Noon** | a betting rule and a quick duel | M1 | sign and drum-plate lab; P.I.P. advice checked |
| **M4** | **Bounty Night** | wanted posters, knockout cash | M1 | poster lab; bounty sums tested |
| **M5** | **Tony's Birthday + The Trapdoor** | party table; the trapdoor | M2 (removal) | trapdoor lab; table sweep at three phone sizes |
| **M6** | **Two new packets** | Tony's Party Bag and Nigel's Members' Club; pricing of all three packets | M5 | wrapper lab; prices approved |
| then | Batch 2 | the ante (alone, with side-pot tests), Hot Potato, Pot Monster, The Spotlight, The Qualifier | M6 | per event |

### Every event, every time (the checklist)

**Gameplay:** acceptance checks written first; rules; AI that plays the
objective; P.I.P. accurate (facts only on the rule).
**Economy:** simulated with test players; budget test; settles once.
**Save:** reload mid-hand, mid-animation and between hands; old saves
load.
**Presentation:** finished card art; inspect-screen rules (one sentence,
then the details); props through the Pattern Book; animation with a
reduced-motion version; sounds; the result line; the album stamp.
**Checks:** a suite in `npm test`, including a seeded run of 1,000
simulated events checking that chips are conserved, the budget holds and
settlement happens once; the table sweep; the play-test; the emulated
iPhone with real touch.
**Approval:** a phone-first lab link before the prop enters the game;
the owner's sign-off after playing it.

### M1 in detail (the milestone to approve)

1. **The album record** (`career.album`), written in the same save write as
   the packet opening, the event start and the settlement; backfilled
   from held cards and the last result.
2. **The album's look:** mystery slots, PLAYED punch, CONQUERED stamp
   (three grades by rarity), gilt page. The NEW! ribbon in the opening;
   "CONQUERED" beat on the result stage. Built in a lab first.
3. **The rules module** (`js/event-rules.js`), empty: the registry,
   snapshot validation and `g.eventState` saved with the table. An event
   with no rules takes exactly today's path, which the existing suites
   prove.
4. **The kind glyph and length pip** on the card front (a small stamp:
   spade for Straight, rule book for House Rules, lit fuse for Madhouse).
   In the same lab, for sign-off.
5. **Career history** (a capped list of finished events: place, prize
   lines, hands, minutes), so pricing can use your real results.

M1 changes no poker, no prizes and no odds. It makes the ten existing
events collectable at once, and every event after it is born with a
place in the album.

---

## F. Critical assessment

### The biggest risks

1. **Art is the bottleneck, not code.** Six events need six finished card
   illustrations, five props, about twenty animation sequences and a dozen
   sounds. *Decision needed:* who draws the final card art? My
   recommendation: I draw it as finished pixel art in the existing card
   style (`invitation-art.js`), you approve it in the lab, and any of your
   own art replaces an entry when it exists.
2. **No Free Rides touches the betting engine and P.I.P.** It's the only
   first-batch event that changes what moves are legal. The legal-actions
   hook gets its own tests (every street, all-in cases, the timeout) before
   the rule uses it.
3. **Three Strikes' fold-everything exploit.** The 15-hand limit and
   chip placing should handle it; the nit test decides, with CHICKEN in
   reserve.
4. **Removing a player who still has chips** is new. The Trapdoor and
   Three Strikes both do it, between hands only, never mid-pot. Chips are
   conserved by test (they go to the house, counted).
5. **The album change alters a signed-off screen** (the mystery slots).
   It goes through a lab and your sign-off like any visual change.
6. **The packets' value** rests on AI stand-ins until your own results
   are recorded (M1). Expect to retune at M6.

### Redundancies, checked

- **Three Strikes and The Trapdoor** both remove players by a rule. Kept
  both: different triggers (losing showdowns vs having the smallest
  stack), different strategies (don't call vs don't be short). They
  shouldn't sit next to each other in the same packet slot weighting.
- **High Noon and Face to Face** are both duels. Kept: one is three
  minutes of all-in-or-fold, the other a full heads-up match.
- **Bounty Night and The Contract**: the Contract waits for batch 3, so
  bounties have room to breathe.
- **Hot Potato and The Crown**: the Crown is cut.
- **Tony's Birthday could become padding** ("Nigel's Book Club",
  "Mavis's Bingo Night"...). Allow at most two theme nights in the
  catalogue.

### Technical complications

- The engine's automatic move ("check") on a timeout, under No Free Rides.
- P.I.P.'s check recommendations, under No Free Rides.
- The action drum showing only two keys (High Noon) and a voided key (No
  Free Rides): new key states for the Pattern Book.
- Seat-card space at six players on a 375 × 667 phone for strike boxes
  and posters. The table sweep fails on any overlap.
- Old saves: `career.album` and `g.eventState` must be optional and
  validated.

---

## The first event to build: Three Strikes

**Build Three Strikes first (milestone 2, straight after M1's album and
rulebook).**

- It's the strongest idea on the list: one sentence to learn, and it
  changes every call you make, with a bully-the-two-strike-player
  strategy that comes out of the rule by itself.
- It doesn't touch the betting rules, so the poker engine stays as it is
  while the new parts are proven.
- It builds the two pieces the next events reuse most: **stamps on seat
  cards** (Bounty Night's posters, Hot Potato's bomb) and **removing a
  player between hands** (The Trapdoor).
- It's funny on the phone straight away: the stamp thump, the buzzer,
  Mavis striking out on hand six.

### Decisions for the owner

1. Approve the six for batch 1: Three Strikes, No Free Rides, High Noon,
   Bounty Night, Tony's Birthday, The Trapdoor?
2. Approve **M1** (the album record and look, the empty rules module, the
   card glyphs, Career history) as the first build?
3. No Free Rides' minimum bet: **half the pot**, from the flop?
4. Pot Monster redesigned as a strength-tester with an appetite line, in
   batch 2?
5. Who draws the final card art?
6. Packet names and curators: Tony's Party Bag and Nigel's Members' Club
   (working names), both at M6?
