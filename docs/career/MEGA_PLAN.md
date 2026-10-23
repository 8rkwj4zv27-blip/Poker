# The Career Mega Plan

Written 23 October 2026 against `main` at v0.71.0 (commit `906d844`).
**Status: proposal, awaiting the owner. Nothing here is approved or
built.** It answers the owner's brief "Career Mode Mega Plan" (23 Oct),
and supersedes the unmerged *Up the Stakes* proposal
(`docs/career/CAREER_EXPANSION_PLAN.md` on `claude/elegant-knuth-dlchhv`)
wherever the two disagree. **Its immediate roadmap (Section 9) is
replaced by [`EVENT_EXPANSION_V1.md`](EVENT_EXPANSION_V1.md)** (23 Oct),
which also drops The Ringer. No code, odds, prizes, saves or visuals were
changed to write it.

Where a number appears it's either **measured** (and says how) or a
**hypothesis** for the simulator to confirm or kill.

---

## Contents

1. Assessment of the current game
2. The creative direction, reviewed
3. The revised event catalogue
4. Event design sheets
5. Event system architecture
6. Packets, rarities and progression
7. Economic design and validation
8. Visual and production requirements
9. The roadmap
10. Independent critical assessment
11. Final recommendation

---

## 1. Assessment of the current game

### Verified state (23 Oct 2026)

- **The build is still v0.71.0.** `main` hasn't moved since 13 October.
  *Up the Stakes* (20 Oct) sits unmerged on `claude/elegant-knuth-dlchhv`;
  nothing in it is in the game.
- **Ten invitation events**, all ordinary No-limit Hold'em
  (`CAREER_INVITATION_EVENTS`, `js/04-modes-and-scoring.js`): five Common,
  two Uncommon, two Rare, one Legendary. Two shapes only: *hand-limit*
  (placed by chips after N hands, plus a chip bonus) and *knockout*
  (played to the last player).
- **Three packets**: House ($150: three Commons and one slot rolling
  Uncommon 78 / Rare 20 / Legendary 2), Starter (free, once) and Pity.
- **Cards are tickets.** Playing a card uses it up. Each card carries its
  own **roster**, the opponents drawn when the packet was opened
  (`js/event-cards.js`). That's a cheap hook for named-opponent features.
- **Settlement is careful and reusable.** An event's terms are frozen in a
  snapshot at entry (`careerEventSnapshot`); `settleCareerEvent()` credits
  the prize and clears the event in one save write; a reload replays the
  current hand instead of counting it twice.
- **Knockout attribution already exists and is correct for side pots.**
  `resolveEliminations()` credits a K.O. to whoever won the *decisive pot*:
  the last pot layer the busted player was eligible for. Bounties can be
  built on that directly.
- **The AI knows a few table facts, but not what the event wants.**
  `aiFormatAdjustments()` reads heads-up, short stacks and the paid-place
  bubble from public state only. It never reads the hand limit, so nobody
  sits on a lead or shoves late. Every new objective plugs in here.
- **Faces don't leak hand strength.** Moods come from public results only
  (deliberately: `03-opponents.js`). Weaker opponents *do* leak through
  **timing**: the skill dial's `timingTell` makes a Back Room regular
  pause before a big raise, and an elite player never does. That's a real,
  learnable tell, and one event below is built on it.
- **No antes.** The engine has blinds only. Several ideas below need a
  forced ante; it's the one poker-engine addition this plan asks for.
- **Card art is placeholder pixel SVG**, one entry per event
  (`js/invitation-art.js`, 120 × 76). Each entry is meant to be replaced
  with a real picture.

### What the simulator says (measured, `event-sim.js`, 23 Oct)

"You" in the simulator is the game's own AI at a chosen skill.

| Test | Skill 0 | Skill 20 | Skill 70 | Reading |
|---|---|---|---|---|
| Back Room, 3 hands, winner $60 | wins 33% | 29% | 32% | Pure luck |
| Back Room, 5 hands | 31% | 32% | 31% | Pure luck |
| Back Room, 10 hands | 33% | 31% | 35% | Almost luck |
| Face to Face (heads-up knockout) | - | 55% | 52% | A coin flip |
| Closing Time (4 players, 20 hands) | +$57/event | +$53 | +$85 | **Skill shows** |

Two conclusions shape the whole economy section:

1. **Short events and heads-up knockouts are lotteries** in this engine.
   They can be fun, but they must never be the best way to earn money.
2. **Skill shows in longer, multi-way events.** That's where the money
   should be.

A caveat: the AI's skill dial is a weak stand-in for a human. A human who
reads the timing tells, or exploits the Maniac, may beat these numbers.
We don't know yet, because Career records no history of the owner's own
results. Section 7 fixes that first.

### What works

The physical machine, the hub and tray, the packets and opening, the
album, the event clock, the result stage, the careful settlement, and
characters on every card. The loop works; it's just thin.

### What's missing

- **A goal.** Money only buys more House Packets.
- **Risk.** A House Packet returns 1.4-1.8 times its price (Stage 7's
  economy run), so the bankroll only creeps up.
- **Choice.** One packet, and every card plays the same game.
- **Variety.** Ten events, two shapes. Rarity mostly means "bigger prize".
- **Character.** Opponents are on the card, but no event is *about* them.

### What the new Career has to achieve

A player opens a packet, finds something strange, plays it, understands
it within one hand, wants to play it again, and has something to save
towards. Good poker earns more over an evening than lucky poker. Nothing
about normal Hold'em is broken to get there.

---

## 2. The creative direction, reviewed

### "Mario Party meets Texas Hold'em": verdict, yes, with one rule

**Strengths**

- It's distinctive. No other mobile poker game is a velvet machine full
  of contraptions. The art direction (physical buttons, chips that fall,
  cards that fly, faces that react) already suits it.
- It's cheap in the right place. A bomb that moves between seats, or a
  trapdoor under a seat, changes *why* you play a hand without touching
  the deal, the evaluator or side pots.
- It makes characters matter. A bomb in front of Tony, the Maniac,
  is funnier than a bomb in front of seat 3.

**Weaknesses and risks**

- **Party games are luck-forward; poker is skill-forward.** Mario Party
  is famous for its random stars. If our twists reward luck, the measured
  luck problem gets worse. Every twist here must give the player a
  *decision* that a good player makes better.
- **Rule fatigue.** Each event that needs a paragraph of rules is a tax.
  On a phone, the player has to get the whole twist from one sentence and
  one object on the felt.
- **Distorted poker.** If the best response to a twist is folding
  everything (or calling everything), the event is broken. That's the
  Hot Potato worry, and it's real.
- **Cost creep.** Every contraption is an illustration, an animation, a
  sound, a Pattern Book entry, a reduced-motion version and a 375 × 667
  layout. That's most of the cost, not the rule.

**The rule that makes it work: one twist, one object, one sentence.**
Each new event adds at most one rule beyond Hold'em (Legendaries combine
at most two that the player has already met). The rule lives in a
physical object on the table, and the object explains itself: the bomb
has a fuse you can count, and the trapdoor's warning lamp is on the seat
that's about to fall.

### Hold'em events before new poker variants: agreed

The owner's preference is right, and the measurements strengthen it.
Omaha, Draw and Pineapple each need a new deal, a new dashboard layout,
new AI and a retrained P.I.P.; *Up the Stakes* priced the set at about
15-20 releases. The same effort buys a dozen Hold'em events. **Short
Deck** is the one exception worth keeping in view: it's the cheapest real
variant (a 36-card deck, re-ranked hands, a regenerated preflop table, no
new layout). It stays in *Later*, as a House Rule, if a variant is ever
wanted.

### The six families: too many. Use two axes instead

Quick versus Full is about **length**, not kind. A Tournament is a
**format** (knockout) that any kind can use. House Rules and Mad House
overlap (a bounty is a house rule; a bomb is a house rule with a prop).
Six families would make the player learn six labels and still blur.

**Recommendation: every card shows a KIND and a LENGTH.**

| Kind | Promise to the player | Examples |
|---|---|---|
| **STRAIGHT** | Proper poker. Different tables, stakes and formats | Closing Time, Final Table |
| **HOUSE RULES** | Proper poker with one extra rule to play around | Bounty Night, The Ringer |
| **MADHOUSE** | A contraption on the table | Hot Potato, The Trapdoor |
| **SIDESHOW** | Not poker: a little card or chip game (later) | In Between |

| Length | Roughly | Shown as |
|---|---|---|
| **QUICK** | under 6 minutes | one notch on the card's clock pip |
| **FULL** | 6-15 minutes | two notches |
| **LONG** | 15 minutes or more | three notches |

(Minutes per hand on the phone are unmeasured, so the boundaries will
move once Section 7's history exists.)

Named opponents, duels and rivals are **character features** any kind can
carry, exactly as the brief says. They're shown by the card's roster, not
a family.

The card's **rarity colour** (cream, green, blue, yellow) stays the
loudest thing on the card. Kind is a small stamped glyph, and length is
the clock pip.

---

## 3. The revised event catalogue

### How each candidate was judged

Ten criteria from the brief, reduced to a verdict. Short reasons only;
the survivors get full sheets in Section 4.

### The existing ten

| Event | Verdict | Why |
|---|---|---|
| Back Room (C) | **Keep** | The learning table. Reprice: today it pays every place, so it can't lose |
| Full House (C) | **Keep** | Six faces, busy table, short. Fine as is |
| Closing Time (C) | **Keep, upgrade** | The best skill test we have (measured). Give it *Last Orders*: the final hand is played with a big ante from everyone, so it ends with a bang |
| Face to Face (C) | **Keep** | The duel. A coin flip, so it pays modestly |
| Deep Pockets (C) | **Retire from packets** | Least distinct. Cards already owned still play |
| Sponsored Night (UC) | **Retire from packets** | It *is* the payout multiplier the brief rejects. Bounty Night replaces it |
| Last Stack Wins (UC) | **Keep, reprice** | Worth less than a Common today (measured) |
| The Private Game (R) | **Demote to Uncommon** | A good long game with no event to it. Give it a host (a named face from its roster who greets you) |
| Final Table (R) | **Keep** | The tournament. It already has a final-table beat to reuse |
| The Golden Ticket (L) | **Rework** | Today it's a $2,000 lottery (10 hands, 3 players). It becomes the ticket to **The Big Game**: win it and your prize is a free seat there (Section 6) |

### The fifteen proposed

| # | Candidate | Verdict | Why |
|---|---|---|---|
| 1 | Three-Hand Dash | **Cut** | Measured: at 3 and 5 hands the weakest and strongest players win equally often. Antes or a different victory condition don't fix it: three hands is too few for a decision to matter. *High Noon* (below) does "quick" with a decision every hand |
| 2 | Survivor's Cut | **Merge into The Trapdoor** | Same objective (survive), less personality. Its AI work (play for survival) is The Trapdoor's AI work |
| 3 | Bounty Night | **Essential** | K.O. attribution already exists. Wanted posters are a natural prop. Rewards aggression, which the AI already supports |
| 4 | The Contract | **Merge, then Good** | As a menu of three objectives it's a checklist. As *one signed contract on one named opponent*, it's a character event. It becomes Bounty Night's Rare cousin (same plumbing) |
| 5 | The Qualifier | **Essential** | Cards that pay in cards: the progression link the economy needs. Cheap: the prize card is drawn when the packet opens, like the roster |
| 6 | Hot Potato | **Essential, redesigned** | The signature idea. The fold-to-pass rule is broken (it rewards folding); the redesign passes the bomb by *winning* (Section 4) |
| 7 | Bingo Bastards | **Good** | A second objective layer that the AI can ignore fairly. Needs the shared "docket" part. Name: see Section 10 |
| 8 | The Trapdoor | **Essential** | A new rhythm, cheap to build (a removal between hands), a great physical moment |
| 9 | The Heist | **Good** | Real agency outside betting. Needs care so walking away is never a free-money exploit |
| 10 | The Big Red Button | **Merge** | Not an event. It becomes **the machine's choice control**: the physical button or lever every "bank or risk it" decision uses (the Heist first) |
| 11 | The Executioner | **Essential (Legendary)** | A proper boss, made interesting by a *telegraphed pattern*, not by chips alone (Section 4) |
| 12 | The Gauntlet | **Good, later** | Three heads-up matches are three coin flips (measured): about one clear in eight, whatever your skill. It needs stage banking and hand-limit duels to be fair. Late |
| 13 | The Madhouse | **Good, last** | Only after Hot Potato and The Trapdoor are proven separately. It combines exactly those two |
| 14 | Find the Ace | **Later** | Charming once, thin twice. Better as an interlude inside an event than an event |
| 15 | Chip Jenga | **Later, prototype only** | Real stacking needs dexterity physics and is the most expensive idea here. The cheap version (a wobble meter) is a random-number game. `coin-world.js` makes a real prototype possible, but only after everything else |

### The parked ideas, re-checked

| Idea | Verdict |
|---|---|
| Bomb Pot Night | **Later.** Fun and legitimate, but the name clashes with Hot Potato's bomb; its best bit (everyone in a big pot) is in Closing Time's *Last Orders* |
| Wanted! / Hunt / Hit List | **Merged** into Bounty Night and The Contract |
| Revenge! | **Kept as a character feature**: the *Rematch* card (Section 4) |
| King of the Hill | **Cut.** A points meter for holding the chip lead: another progress bar |
| The Great Escape | **Merged** into The Heist |
| Crack the Safe | **Merged** into The Heist's look (the vault) |
| The Impostor | **Reborn as The Ringer** (below). The best rescue on the list |
| Sink the Shark | **Kept as a look**: the defeat animation for The Contract's mark |
| The Claw | **Later**: a lovely prize dispenser for Golden Reserve packets, not an event |
| One Hand Wonder | **Cut.** One hand with random cards is mostly "fold, the end" |
| Hot Streak, Lucky Sevens, Mystery Bounty | **Cut.** Luck multipliers |
| Dealer's Exam | **Later**, as a Sideshow or tutorial |
| In Between / Acey-Deucey | **Later**: the cheapest Sideshow (three cards, one bet) |
| Blackjack, Liar's Deck | **Later**: new engines |
| Short Deck | **Later**: the first variant, if any |
| Omaha, Five-Card Draw, Crazy Pineapple | **Not in this plan** |
| Chip Snake, Magnet Run, Puppet Master, Piñata, Finish Line | **Cut**: no decision a good poker player makes better |

### My own ideas (twelve generated, five kept)

| Idea | What you do | Verdict |
|---|---|---|
| **High Noon** | Heads-up, 12 big blinds. Every hand you may only DRAW (all-in) or HOLSTER (fold). A western standoff on the felt | **Essential.** Quick, a real decision every hand (push/fold is real tournament skill), and the AI already has push ranges (`standardPushRange`) |
| **The Ringer** | One opponent is secretly a professional among regulars. Once per event you may ACCUSE a seat. You find the ringer by reading: the regulars have timing tells, the pro has none | **Prototype.** The most "Poker Faces" idea here (reading people), built on a tell the AI already has. Must prove the tell is visible on a phone |
| **Last Orders** (a rule, not an event) | The last hand of a hand-limit event: everyone posts a big ante, so the final pot is huge and anyone can still win | **Essential, as an upgrade to Closing Time.** Fixes the "death march" ending found in Stage 7 |
| **The Rematch** (a card, not an event) | A face that knocked you out of a Rare comes back on a Rematch card: heads-up, deeper stacks, their line on the card | **Good**, with the owner's yes (it brushes parked Phase 7) |
| **The Loan Shark** | A character at the table lends you chips once, repaid double from your prize | **Cut.** A good joke, but it's a rebuy, and rebuys edge toward money buying power |
| The Forehead Game | Indian poker: one of each player's cards is shown to everyone but its owner, stuck on their face | **Later.** A wonderful picture, but it needs new AI equity work |
| Open Secrets | One hole card each face up | **Later** (same AI work as above, less fun) |
| The Night Train | Stations every few hands; passengers get on and off | **Cut**: The Trapdoor does it better |
| The Raffle Drum | Pots won drop tickets in a drum; one draw at the end | **Cut**: a progress meter with a lottery on top |
| The Shot Clock | Decisions on a short timer | **Cut**: bad for accessibility, bad on a phone |
| Partners | You and an AI as a team | **Cut**: invites soft play, which is collusion |
| The Masquerade | Opponents' faces hidden | **Cut**: faces don't leak strength, so hiding them changes nothing |

### The recommended catalogue (after the second review)

**First review's list** had 15 new events. The second pass (Section 10)
cut it to **ten new events plus two upgrades**, built in the order of
Section 9.

| Kind | Length | Rarity | Event | Status |
|---|---|---|---|---|
| Straight | Quick | C | Back Room | live, repriced |
| Straight | Quick | C | Full House | live |
| Straight | Full | C | Closing Time + *Last Orders* | live, upgraded |
| Straight | Full | C | Face to Face | live |
| Straight | Quick | C | **High Noon** | new |
| Straight | Long | U | Last Stack Wins | live, repriced |
| Straight | Long | U | The Private Game (with a host) | live, demoted |
| Straight | Long | R | Final Table | live |
| House Rules | Long | U | **Bounty Night** | new |
| House Rules | Full | U | **The Qualifier** | new |
| House Rules | Full | U | **Bingo** | new |
| House Rules | Full | R | **The Ringer** | new, prototype gate |
| House Rules | Long | R | **The Contract** | new |
| Madhouse | Full | U | **Hot Potato** | new |
| Madhouse | Full | U | **The Trapdoor** | new |
| Madhouse | Full | R | **The Heist** | new |
| Straight | Full | R | **Rematch** (earned, not packed) | new, needs a yes |
| Madhouse | Long | L | **The Executioner** | new |
| Straight | Long | L | **The Gauntlet** | new, late |
| Madhouse | Long | L | **The Madhouse** | new, last |
| House Rules | Quick | L | The Golden Ticket (wins a Big Game seat) | live, reworked |
| (marquee) | Long | - | **The Big Game** (three tables) | new, not a card |

Twenty-one cards in packets by the end (Deep Pockets and Sponsored Night
retire from packets), plus the marquee. Every kind has a Quick or Full
Common or Uncommon, so nobody grinds plain poker to reach the strange
stuff.

---

## 4. Event design sheets

Prizes are **House-floor** figures and are **hypotheses**: the method in
Section 7 sets the real ones. "Budget" is the most the event can ever pay
out, checked by a test.

### HIGH NOON (Straight · Quick · Common)

- **Rule:** heads-up, 12 big blinds each, blinds up every 3 hands. The
  only moves are **DRAW** (all-in, or call an all-in) and **HOLSTER**
  (fold). Last gun standing wins.
- **Length:** about 6-10 hands, 3 minutes.
- **What the player does:** one honest decision every hand: is this hand
  good enough to shove from here, or to call one? P.I.P. can coach it
  truthfully (push/fold is exactly what its equity model does well).
- **Prize:** winner only, about $30. Budget $30.
- **AI:** reuses `standardPushRange`; needs a matching calling range by
  stack depth. Personality bends it (Tony draws wide, Nigel narrow).
- **Look:** the two faces at either end of the felt; a church clock on
  the board strikes the hand; the action drum shows two keys only (DRAW in
  brass, HOLSTER in wood). On a showdown the cards are "drawn" with a
  quick slide from the holster side.
- **Sound:** bell toll per hand, a single gunshot crack on the all-in.
- **Cost:** S. A rule that limits legal actions (engine), two drum keys
  (Pattern Book: same key finish, new labels).

### BOUNTY NIGHT (House Rules · Long · Uncommon)

- **Rule:** five players, knockout. Every opponent has a **bounty**
  poster. Knock them out and you collect it on the spot, whatever your
  final place.
- **Length:** about 20 hands.
- **Bounties:** printed on the card when the packet opens: $15-$35 each,
  higher on the more dangerous faces. When an *opponent* knocks someone
  out, half the victim's bounty is stapled onto the winner's poster (so a
  hot player becomes a juicy target) and the other half goes back to the
  house. The bounty money can only move or shrink, never grow.
- **Places:** 1st and 2nd paid (about $60 / $25).
- **Budget:** places plus every starting bounty. Checked by test.
- **Attribution:** the existing decisive-pot rule. If the decisive pot is
  split, the bounty splits, rounded down. Two knockouts on one hand are
  two separate bounties.
- **AI:** calls wider when covering a short stack with a bounty;
  public information only, so it goes in `aiFormatAdjustments`.
- **Look:** a little wanted poster pinned to each seat card (face, price
  in stamped type). On a K.O. the poster is torn off, flies across the felt
  to your bank, and the dollar figure rolls onto your take tally at the
  console's edge. On an opponent's K.O., the torn poster is stapled onto
  theirs (two staples, a thunk).
- **Sound:** paper rip, staple thunk, a cash-register *ching* on yours.
- **Cost:** M. First user of the event-rules hook (Section 5).

### THE CONTRACT (House Rules · Long · Rare)

- **Rule:** five players, knockout. Before the first hand three sealed
  contracts lie on the felt, each naming one opponent and a price (a
  bigger stack or a better player costs more). **Sign one.** Knock out
  that player and the contract pays. Normal places pay as well.
- **Why it's better than "choose an objective":** it's personal. The
  target *knows* (one line of table talk: "Heard someone's been paid to
  come after me"), and plays tighter against you. You've chosen a fight
  with a character.
- **Prize:** contract $60-$120; places $80 / $30. Budget: places plus the
  most expensive contract.
- **AI:** the mark tightens against you; everyone else plays normally.
- **Look:** three envelopes on the felt; the signed one stamps itself onto
  the mark's seat card with a red seal. When they go: the *Sink the
  Shark* moment (their card drops into a little dunk tank at the seat's
  edge, a splash of pixel water).
- **Cost:** M (shares Bounty Night's plumbing).

### THE QUALIFIER (House Rules · Full · Uncommon)

- **Rule:** four players, 12 hands, placed by chips. **1st wins the card
  in the glass case**; 2nd wins a little cash.
- **The prize card** is drawn when the Qualifier's packet is opened (like
  the roster) and saved on the Qualifier card itself. The inspect screen
  shows it. A reload, an abandon or a replay of the opening never rerolls
  it.
- **What it can be:** one rarity higher than the Qualifier, or (once
  floors exist) the same rarity one floor up. Never another Qualifier,
  never a Golden Ticket, so cards can't chain into cards.
- **Prize:** the card, plus $25 for 2nd.
- **Look:** a small glass case at the board's far edge with the prize card
  standing in it. Win: the case lid flips, the card flies to your tray.
  Lose: the case's shutter rolls down.
- **AI:** plain chip-count event (needs the hand-limit awareness from
  milestone 1).
- **Cost:** S-M.

### HOT POTATO (Madhouse · Full · Uncommon): redesigned

**The problem with the proposed rule.** If folding passes the bomb, the
best way to get rid of it is to fold, and the best way to avoid it is to
make sure you're never the last to fold. That rewards folding good hands,
which is bad poker and a dull game.

**The redesign: you pass the bomb by winning.**

- **Rule:** five players, 12 hands, placed by chips. One bomb starts in
  front of a random player with a **fuse of 4 notches**. A notch burns off
  after every hand. **Win any pot while holding the bomb and it jumps to
  the player who put the most chips into that pot** (after you). The fuse
  keeps burning: it's a hot potato.
- **The bang:** if the fuse runs out on you, you pay the **blast**: a
  5-big-blind ante on the next hand (into the pot, so everyone else plays
  for it). A fresh bomb is lit on the player to your left.
- **Why it works as poker:**
  - The holder must win a pot soon, so they play aggressively. Everyone can
    see who's desperate, which makes reading easier and bluff-catching
    better.
  - If you tangle with the holder and lose, you get the bomb. If you bet
    and then fold, you might too. So you either stay out of their way
    (fine: they get uncontested pots) or fight back with a real hand.
    That's a tension, not a dominant strategy.
  - The blast is a cost in chips, inside poker's own rules (an ante). It's
    big enough to fear and small enough not to dominate. Its size is set
    by simulation: a "bomb-dodging" test player must not outscore the
    normal one.
- **Prize:** places by chips plus the chip bonus, like Closing Time.
- **AI:** the holder adds aggression as the fuse shortens; the others
  shade their calls against the holder slightly by the blast's cost.
  Public information only.
- **Look (a design project of its own):**
  - The bomb is a round black pixel bomb about a chip stack's size, with a
    brass cap and a rope fuse whose length *is* the count: 4 visible knots,
    each burns away with a fizz between hands. It sits **on the holder's
    seat card**, never on the board.
  - Passing: it hops along a short arc to the new holder's card, landing
    with a wobble (reusing the card-flight motion).
  - Last notch: the fuse spits sparks, the seat card shakes slightly, and
    the holder's face goes from the nervous pool to *terrified*.
  - Bang: a 3-frame pixel blast over the seat card, a puff of soot that
    stays on the card for a hand (blackened face), and the blast ante
    clatters into the pot. Reduced motion: a single white flash frame and
    the word BANG on the card.
- **Sound:** fuse fizz per notch, a deep bit-crushed boom, coins clatter.
- **Cost:** M-L. Needs **the ante** (engine) and the table-piece part.

### THE TRAPDOOR (Madhouse · Full · Uncommon)

- **Rule:** six players, 1,000 chips, blinds up every 3 hands. **After
  every third hand the trapdoor opens under the smallest stack**, and
  they're out (at that place). Players busted normally are out as usual.
  When two are left, they play three more hands; most chips wins.
- **Length:** at most 15 hands.
- **Ties for the smallest stack:** fewer chips at the start of the last
  hand falls; then the one who lost more in that hand; then seat order
  from the button. All deterministic, all printed in the inspect screen.
- **Places:** top three paid (about $80 / $40 / $20).
- **What it changes:** a short stack must gamble *before* the door opens;
  the leaders can tighten up. That's survival poker, with a clock you can
  see, and it replaces Survivor's Cut.
- **AI:** knows the hands left until the door and whether it's the
  shortest or second shortest; the shortest shoves wider as the door
  nears; the comfortable tighten.
- **Look:**
  - A warning lamp on the seat card of whoever is currently shortest,
    blinking during the last hand before the door (amber, then red). It
    moves as stacks change, so everyone can see who's in danger.
  - The drop: the felt under that seat splits along the rail, the seat
    card tips and falls through with its chips sliding after it, and two
    brass hatch doors snap shut. It reuses the K.O. ceremony's timing
    (`knockout.js`) with a different exit.
  - The face's last expression (shocked) is what falls. A distant thud.
- **Sound:** a ratchet clunk on each hand of the round, a lever
  *ka-chunk*, a falling whistle, a thud.
- **Cost:** M. A between-hands removal plus the table-piece part. No
  engine change to betting.

### BINGO (House Rules · Full · Uncommon)

- **Rule:** four players, 15 hands, placed by chips. You hold a 3 × 3
  bingo slip of poker objectives (free centre). Things that happen in a
  hand stamp squares. **Each completed line pays a bonus**, once.
- **The objectives** are drawn when the packet opens, from a pool of
  things that happen in *good* poker:
  - Win a pot at showdown; win one without showdown; win from the blinds;
    win a pot of 10 big blinds or more; raise first in and win; make a
    straight or better; survive an all-in; knock someone out; finish a
    hand as chip leader; win two pots in a row.
  - Never anything that rewards a bad play ("win with 7-2", "call an
    all-in with the worst hand").
  - Each slip is checked to be completable in 15 hands at a sensible rate
    (simulated: about 1 line in 2 events at reference skill).
- **Prize:** places as normal, plus $15 per line, at most 3 lines paid
  (budget capped). A full slip earns an album stamp, not money.
- **AI:** none; the opponents don't have slips. Fair, because their goal
  doesn't change.
- **Look:** the slip lives in **the docket** (Section 8): a paper stub
  tucked into the console's edge. Stamps are applied between hands: the
  docket peeks up, a rubber dabber thumps a square in red ink, and it
  tucks away. Tap the stub to pull it up any time; the poker doesn't wait
  on it.
- **Cost:** M. The objective detectors read the settled hand's outcome.

### THE HEIST (Madhouse · Full · Rare)

- **Rule:** four players, three stages of four hands. The vault holds the
  big prize for whoever has most chips after hand 12. **After hands 4 and
  8, if you're above your starting stack, the vault offers you a cash sum
  to walk away.** Pull the escape lever and you leave with it (your event
  ends). Stay and you play on for the vault, or nothing.
- **The offer** is printed on the money counter, from a formula the
  inspect screen shows: your share of the chips times a stage rate. It's
  always a little below what staying is worth to an average player (set
  by simulation), so walking is safe, not free money.
- **Opponents escape too.** An AI over its comfort line may take its
  offer: its chips leave the table, the seat goes dark ("Tony's out the
  window"). The table shrinks, the stakes rise.
- **Each stage the alarm grows:** the blinds jump and the machine's lamps
  shift from amber to red.
- **Prize:** vault $200 for 1st after hand 12, $40 for 2nd. Escape offers
  up to about $90 (stage 1) and $150 (stage 2). Budget: the vault plus
  the largest possible escapes, checked.
- **AI:** knows the stage; decides to escape by chip share and
  personality (Nigel walks early, Tony never).
- **Look:** a squat brass vault door at the board's far edge with a
  spinning dial and a mechanical money counter. The **escape lever** is
  the machine's shared choice control (the merged Big Red Button). The
  lamps on the cabinet strip go amber, then red.
- **Sound:** dial clicks, alarm bell at each stage, a slide-whistle on an
  escape.
- **Cost:** M-L. Between-hands decision, saved before it's shown.

### THE RINGER (House Rules · Full · Rare): prototype first

- **Rule:** five players, 15 hands, placed by chips. **One opponent is a
  ringer**: a professional (skill 85) hiding among regulars (skill 15).
  Once, between any two hands, you may **ACCUSE** a seat. Right: a bonus,
  and the ringer is unmasked. Wrong: no bonus, and the regular you
  accused takes offence (one line of table talk).
- **How you find them:** the regulars' think time gives their hands away
  (the existing `timingTell`): they pause before a big raise. The pro
  doesn't. The pro also sizes bets without the regulars' size tells. A
  watchful player can spot them in 8-10 hands. That's real reading, in a
  game literally called Poker Faces.
- **Prize:** places $70 / $30, accusation $80. Budget $180.
- **P.I.P.:** stays honest: "I read cards, not people."
- **AI:** existing skill dial, nothing new. The ringer is drawn when the
  packet opens and hidden from the card.
- **Look:** a little magnifying glass in the docket; ACCUSE is the
  machine's choice control, then a tap on a seat. Unmasking: the seat
  card's face flips to the same face in sunglasses (one new face overlay).
- **The gate:** a play-test must show the tells are visible at real speed
  on a phone. If testers guess no better than chance (1 in 4), **cut it**.
- **Cost:** M.

### REMATCH (earned card · Full · Rare): needs the owner's yes

- **How you get it:** a face who knocks you out of a Rare or better comes
  back, now and then, as a *Rematch* card tucked into your next packet as
  an **extra** card (never replacing one you paid for).
- **Rule:** heads-up against them, 30 big blinds, 15-hand limit, chips
  decide (hand-limit duels are less of a coin flip than knockouts).
- **Prize:** $80, and their portrait stamped *BEATEN* on the album's Faces
  page.
- **Look:** the card has their face and their line ("Back for more?").
- **Cost:** S-M. Touches parked Phase 7 lightly: records only, no
  relationship counters.

### THE EXECUTIONER (Madhouse · Long · Legendary)

- **The problem:** a boss with a huge stack is just a long grind.
- **The answer: a telegraphed pattern you can learn and exploit.**
  - Five seats: you, three other victims, and the Executioner with four
    times everyone's stack.
  - **Every fourth hand, the Axe falls:** the Executioner moves all-in
    *before the cards are dealt* (a blind shove, his own announced
    strategy; no deck tricks). A counter on his card shows THE AXE FALLS
    IN 3, 2, 1. That hand is the window: call with a decent hand and you
    can take a huge bite.
  - On the other hands he plays at high skill as a bully (the Hammer
    personality, turned up).
- **Objective ladder** (shown on his card): **survive** 20 hands ($),
  **finish above your starting stack** ($$), **bring him down** ($$$$ and
  a permanent album trophy).
- **AI:** the victims learn to call the Axe with a top range; the
  Executioner's own logic is a fixed pattern plus the normal AI.
- **Look:** he sits at the head seat. His seat card is **taller** (a
  double-height plinth card with an iron frame), his stack is a visible
  tower, and his face is a hooded figure (new art). Intro: the house
  lights drop, a slow drumroll, his card lowers from the top of the
  screen on chains. Defeat: the chains snap, his card falls forward onto
  the felt, the hood falls off to show an ordinary, embarrassed face.
- **Cost:** L. New face art, a taller seat card variant (Pattern Book).

### THE GAUNTLET (Straight · Long · Legendary): late

- **Rule:** three heads-up duels in a row, against three styles you must
  read: Nigel (the Rock), Tony (the Maniac), Lucy (the Shark at high
  skill). Each duel is 15 hands, chips decide. **Each win banks its stage
  prize** before the next starts. A loss ends the run; you keep what's
  banked.
- **Why hand-limit duels:** heads-up knockouts are a coin flip (measured
  55% vs 52%). Fifteen hands with chips deciding gives skill more room;
  to be confirmed by simulation before building.
- **Prize:** $100 / $200 / $600 banked per stage.
- **Look:** a three-lamp ladder above the board; each beaten face is
  stamped and hung beside it.
- **Cost:** L. The first **multi-stage** event (Section 5).

### THE MADHOUSE (Madhouse · Long · Legendary): last

- **Rule:** six players. **Stage 1:** Hot Potato with the Trapdoor
  (the door every third hand, the bomb burning) until three are left.
  **Stage 2:** the three play a Last Orders finish: four hands, then the
  big ante hand.
- Two rules at once at most, both already known to the player.
- **Cost:** M (once the parts exist).

### THE GOLDEN TICKET (House Rules · Quick · Legendary): reworked

- **Rule:** three players, 10 hands, chips decide. **1st wins a seat at
  The Big Game** (your current floor's table), skipping its buy-in. 2nd
  wins $50.
- Turns a lottery into a jackpot with meaning.

### THE BIG GAME (the marquee, not a card)

See Section 6.

---

## 5. Event system architecture

### What the code already gives us

- The **snapshot**: an event's terms frozen at entry, validated by
  `isValidCareerEventSnapshot()`, carried into the table save. Old cards
  keep old terms.
- **Hand-end flow**: `finishHand()`'s Career branch resolves knockouts,
  checks the hand limit and calls `endCareerEvent()`, which calls
  `settleCareerEvent()`, the one write that credits money.
- **K.O. attribution** by decisive pot.
- **Cards decided at packet opening** (the roster), stored with the card.
- **`aiFormatAdjustments()`**, the public-state-only way to tell the AI
  about the format.

### The smallest robust addition: one rules module

A new file, `js/event-rules.js`, loaded after `04-modes-and-scoring.js`.
An event declares its rules as data in the catalogue:

```js
rules:[ { kind:'bounty', bounties:'card' } ]
rules:[ { kind:'trapdoor', every:3, finalHands:3 } ]
rules:[ { kind:'potato', fuse:4, blastBB:5 } ]
```

Each rule kind is a small object of **pure functions**, only those it
needs:

| Hook | Called | Returns | First user |
|---|---|---|---|
| `validate(rule)` | snapshot validation | true/false | all |
| `init(snapshot, card)` | event start, same write as card use | initial `eventState` | all |
| `antes(g, state)` | before the deal | per-seat forced antes | Hot Potato, Last Orders |
| `legalActions(g, state, p)` | action validation | narrowed list | High Noon |
| `afterHand(g, outcome, state)` | after K.O.s are resolved | new state, presentation cues | Bounty, Potato, Bingo, Trapdoor |
| `ends(g, state)` | after `afterHand` | null, or a finish | Trapdoor, Heist |
| `offer(g, state)` | between hands | a pending choice (saved first) | Heist, Ringer |
| `prizeLines(snapshot, state, finish)` | settlement | list of credited lines | Bounty, Bingo, Heist |
| `aiHints(g, state, p)` | inside `aiFormatAdjustments` | adjustments | Bounty, Trapdoor, Potato |

That's the whole "framework": a registry and a dozen optional hooks.
**Each hook is added the first time an event needs it, not before.**
Bounty Night needs four of them; the rest arrive with their events.

### Rules for the rules

1. **State lives in `g.eventState`**, saved with the table
   (`serializeTable`), checkpointed before the deal like everything else.
   Presentation reads it; it never writes it.
2. **Anything random is decided before the player can see it, and saved
   first**: bounties, contracts, Qualifier prizes, bingo slips and the
   ringer are drawn at packet opening and stored on the card; the bomb's
   first holder is drawn in the same write as the event's start. A reload
   can't reroll anything.
3. **Settlement stays one write.** `settleCareerEvent()` sums
   `prizeLines()` with the place and chip bonus, records each line in
   `career.lastResult`, and credits once. A test proves total paid never
   exceeds the snapshot's **budget**.
4. **Decisions are saved before they're shown.** The Heist's offer goes
   into `eventState.pending` in a save, then the lever appears. Taking it
   settles the event (one write). A reload during the offer shows the same
   offer.
5. **Normal events never see a rule.** An event without `rules` takes
   exactly today's code path, and the existing suites prove it.
6. **Old cards keep old terms**, through the snapshot, as now.
7. **The AI only gets public state** from `aiHints`, matching
   `aiFormatAdjustments`'s promise.

### The one engine change: antes

Forced antes per seat, added in the deal before blinds, counted in each
player's `totalBetHand` so side pots form correctly (a player all-in on
the ante is eligible for the main pot only). This is real poker, needed
by Hot Potato, Last Orders and later Bomb Pots, and it gets its own
release with its own side-pot tests **before** any event uses it.

### Multi-stage events (only for The Gauntlet and The Madhouse)

`career.active` gains `stage` and `banked`. A stage end is a
settlement-like write (bank the stage's prize, start the next stage's
table). Built with The Gauntlet, not before.

### What I'm deliberately not building

- A general minigame engine. Sideshows, if they come, get their own small
  module when the first one is approved.
- A variant adapter for Omaha, Draw and the rest.
- A scripting language for events. Rules are code; terms are data.

### P.I.P.

P.I.P. keeps coaching the poker, where its model is honest. For event
rules it only states facts, from `eventState`: "The trapdoor opens after
this hand. You're the shortest stack." No advice on rules its model
doesn't understand.

### Save safety

- New card fields (bounties, contract, prize card, slip, ringer) are
  optional and validated on load; a damaged one drops that card, as today.
- `eventState` is optional in the table save; an old table save has none.
- Career history (Section 7) is a new list inside `felt.career.new`, capped
  in length, so no new saved key.

---

## 6. Packets, rarities and progression

### What rarity means

**Rarity is how special the night is: scarcity, spectacle and prestige.
It never multiplies prizes.** Each rarity has a design budget:

| Rarity | Rules beyond Hold'em | Staging | Example | Can be Quick? |
|---|---|---|---|---|
| Common | none, or a format | the normal table | Back Room, High Noon | yes |
| Uncommon | **one**, in one sentence | one prop | Hot Potato, Bounty Night | yes |
| Rare | one rule **plus a decision or a character** | a prop and a moment | The Heist, The Contract | yes |
| Legendary | at most **two known** rules, or a boss | an intro, a defeat, a trophy | The Executioner | yes (Golden Ticket) |

Length is free at every rarity. A Legendary isn't an hour long; a Common
isn't dull. Money per *minute* rises only gently with rarity (Section 7):
scarcity is what keeps the economy safe, not small prizes.

### Packets

Two dials on the machine: **which packet** (the kind of evening) and,
once floors open, **which floor** (the stakes).

| Packet | Character | Cards | Odds sketch | When |
|---|---|---|---|---|
| **House Selection** | a bit of everything | 4 | C C C + (U 75 / R 22 / L 3) | now (the House Packet) |
| **Madhouse** | contraptions and house rules | 4 | weighted to Madhouse and House Rules | with Hot Potato, Trapdoor, Heist + 3 House Rules |
| **Poker Club** | proper poker and tournaments, bounties | 4 | weighted to Straight and Bounty/Contract | with Bounty Night + 5 Straight |
| **Quickfire** | short games | 5 | Quick only, a little cheaper per card | once 6 Quick events exist |
| **Big Shots** | named faces and headliners | 3 | U R R+, Legendary 6% | at the Club floor |
| **Golden Reserve** | prestige | 2 | R R+, Legendary 25% | at the High Roller floor |
| Starter, Pity | as now | | | now |
| Sideshow | later | | | if Sideshows exist |

*Knockout Kings* is folded into Poker Club: it would have been three
cards deep.

**Rules for the shelf:**

- **A themed packet appears only when at least six distinct events of its
  theme exist**, across at least two rarities. No dark slots; a slot that
  isn't open yet shows a brass plate saying how it opens ("THE CLUB
  ONLY"). That's aspiration, not a broken promise.
- **Equal value, different flavour.** At the reference player, every
  themed packet returns the same money per dollar (within 5%). They differ
  in *what* you play, how long and how swingy. That stops any one packet
  being the obvious buy.
- **Golden Reserve is the exception, on purpose:** it returns a little
  less per dollar (about 0.85-0.9 of the others) because you're buying
  the best experiences. It's aspirational, not efficient.
- **Fixed counts**, printed on the packet.
- **Duplicates are fine**: cards are tickets, so a second Hot Potato is
  another evening of Hot Potato. To keep discovery moving, **an event you
  haven't seen yet counts twice when a slot draws among its rarity**.
  Cheap and honest.
- **Extensible to other collectibles, later.** A packet's contents are a
  list of items with a `type`; today every item is `invitation`. A future
  card back or cabinet finish would arrive as a clearly labelled **bonus**
  item on top of the printed count, never in place of a paid invitation.
  Not built now.

### Floors: House, Club, High Roller

Floors are **stakes**, not content. Every kind exists on every floor, so
nobody grinds plain poker to see the strange stuff.

| Floor | Opponents (skill dial) | Prizes and prices | What opens |
|---|---|---|---|
| THE HOUSE | 15-30 | × 1 | everything in the catalogue, Big Game House table |
| THE CLUB | 35-50 | × 3 | Big Shots, the Rematch, Club Big Game |
| HIGH ROLLER | 55-75 | × 8 | Golden Reserve, THE BIG GAME |

- A card is **printed with its floor** when drawn (a small enamel plate:
  green felt for House, burgundy for Club, black and gold for High
  Roller). The same Hot Potato is tougher and pays more at the Club.
- Prices scale with prizes, so value per dollar is the same on every
  floor at the same skill. But the opponents are better, so **only a
  genuinely good player earns faster by climbing.** The floor sorts
  players by itself: weak players lose money upstairs and come back down.
  (Whether the AI's higher skill really makes a table tougher must be
  measured first, Section 7.)
- The album has **one slot per event**; floors show as stamps on the slot
  (House, Club and High Roller wins).

### The Big Game: one marquee, three tables

The brief warned against several unrelated finales. So there's **one
marquee** on the hub, visible from the first day: **THE BIG GAME**, with
three lamps under it (HOUSE TABLE, CLUB TABLE, HIGH ROLLER TABLE). Each
floor's big game is a table of the same marquee, and the last one *is*
the finale.

- **It's a permanent fixture, not a card.** Nobody depends on pulling one
  invitation.
- **A table's lamp lights when you've won three different events on that
  floor.** Any kinds: a player who loves the Madhouse gets there through
  the Madhouse.
- **Entry is a Seat:** you pay its buy-in from your bankroll (or present a
  Golden Ticket seat). This is the one place, at first, where the
  bankroll is truly at risk. It's printed on the marquee in plain words:
  "BUY-IN $600. LOSE AND IT'S GONE."
- **Format:** six players, knockout, deep stacks, the floor's best named
  faces, the existing final-table beat when three are left.
- **Promotion: reach the final two** (the heads-up for the title) and the
  next floor opens. Winning isn't required, which halves the luck in the
  gate. **Winning** puts your name on that table's brass plate.
- **The finale:** win the High Roller table and the machine celebrates:
  a gold plate with your name on the marquee, the Golden cabinet finish in
  the Workshop, and the Career's credits rolled on the CRT, with the faces
  you beat. Then Career carries on: the plate counts every win after.
- **Losing** costs the buy-in and nothing else. Sit again whenever.
- **Seats elsewhere** (*Up the Stakes*' Seat cards with bankroll buy-ins)
  wait until the Big Game proves that bankroll risk is fun, not
  punishing.

### Collection incentives

- **Album states:** SEEN (you've held it), PLAYED, WON, with floor stamps.
  Records survive the card being played.
- **Album pages as sets:** win every event on a page and the page gets a
  gilt edge and a one-off cosmetic in the Workshop (a felt, a card back).
  Never power, never money multipliers.
- **The Faces page** (with the Rematch, if approved): met, beaten, beaten
  by.
- **Trophies** for Legendaries (the Executioner's hood, the Gauntlet's
  three stamps), displayed in the album.

---

## 7. Economic design and validation

### Principles (unchanged from the brief)

One currency. No XP. Rarity doesn't multiply money. Players can lose.
Good play wins over time. Recovery always exists. The pity packet stays a
safety net.

### Step 1: measure the real player, not just the AI

The economy has only ever been simulated with AI stand-ins. Two cheap
additions, both in milestone 1:

- **Career history:** for each finished event, record event, floor, place,
  each prize line, hands played and minutes taken (a capped list inside
  the existing Career save). It feeds the album states too.
- **Minutes per hand** on the owner's phone, from that history.

After a week of the owner's play we'll know whether the owner is a
"skill 20" or a "skill 70" player, and how long events really take.

### Step 2: a richer simulator

Extend `event-sim.js` and `invitation-economy.js`:

- **Every rule kind** simulated with the real rule code (the same module
  the game loads).
- **Probe players** that try to break each event: the *nit* (folds all
  but premiums), the *maniac*, the *bomb-dodger* (never tangles with the
  holder), the *always-escaper* (always takes the Heist's first offer),
  the *bounty-hunter* (calls every short stack). **No probe may beat the
  reference player's money per hour** in an event designed around it.
- **Money per hand and per minute**, alongside money per event.
- **Floors:** the reference player against tables at skill 20, 45 and 70,
  to prove a higher floor is actually tougher.
- **Whole Careers by habit:** only Quickfire, only Madhouse, only Poker
  Club, mixed. Each habit must earn within 10% of the mixed one per hour.

### Step 3: price everything by one method

1. **A base rate** *r*: dollars per hand for the reference player on a
   Common Full game at the House. Today's Closing Time sits near $3 a
   hand ($53-66 over 19 hands).
2. **An event's expected payout** (at the reference player) is
   *r* × expected hands × a rarity factor (C 1.0, U 1.1, R 1.25,
   L 1.5) × a luck factor (1.0 for Full and Long games; **0.7 for Quick
   games and heads-up knockouts**, because luck there out-earns skill).
3. **The payout shape** is chosen for skill: winner-heavy tables reward
   skill in long events; flatter tables suit short ones. Every event must
   show strong players earning at least 1.4× weak ones per hand (Full and
   Long) or 1.15× (Quick).
4. **The budget** (the most it can ever pay) is a hard number in the
   catalogue, checked by a test.
5. **The packet price** is set so a House Selection returns **0.95-1.0×**
   its price to the reference player, **1.2-1.35×** to a strong one and
   **0.7-0.8×** to a weak one.
6. **The Big Game buy-ins** are set so a reference player reaches each
   table's lamp and can afford a couple of attempts at about these times
   (hypotheses to test against the history): House table 2-3 hours, Club
   4-6 more, High Roller 6-8 more.

### Each new event's reward model

| Event | Model |
|---|---|
| Bounty Night | places + fixed bounties; bounties only move or shrink; budget = places + all starting bounties |
| The Contract | places + one contract; budget = places + the dearest contract |
| The Qualifier | a card worth (packet value per card of its rarity and floor) is the prize; the event's cash is lowered by that value |
| Hot Potato | places + chip bonus; the blast moves chips, never money |
| The Trapdoor | places only |
| Bingo | places + $ per line, at most 3 lines; full slip is a stamp |
| The Heist | vault + escape offers; offer < continuation value at reference; budget = vault + the largest escape |
| The Ringer | places + accusation bonus; bonus sized so guessing at random (25%) is worth less than one place |
| The Executioner | a three-rung ladder; budget = top rung |
| The Gauntlet | banked stage prizes; budget = their sum |
| The Big Game | entry-funded pool (buy-ins) + a house overlay; prize pool always = buy-ins + overlay |

### Measurable targets (replacing *Up the Stakes*' guesses)

| Target | Value | Why it replaces the old one |
|---|---|---|
| House Selection return, reference player | 0.95-1.00× | same intent as before |
| Strong vs weak, money **per hand**, Full/Long events | at least 1.4× | per hand, because the old "2.5× median bankroll after 100 events" depends on spending habits, not skill |
| Weak player hits the pity packet | at least 1 Career in 5 | unchanged |
| Quick events' money per minute | no higher than Full events' at the reference player | new: stops lotteries being the best job |
| Any probe vs reference, per hour | never higher | new: exploit check |
| Packet habits | each within 10% per hour of mixed | new: no obvious packet |
| Strong player, House table lamp | about 2-3 hours | new: tested against history |

---

## 8. Visual and production requirements

### Three shared parts, built once (Pattern Book entries first)

| Part | What it is | Used by |
|---|---|---|
| **Table piece** | A small physical object that belongs to a seat and sits on its seat card or the felt next to it; moves by short arcs; never covers the board or hole cards. Reuses the event clock's clear-spot finder (`event-clock.js`) | bomb, wanted poster, contract seal, trap lamp, glass case, vault |
| **The docket** | A paper stub tucked into the console's edge; tap to pull it up as a bottom sheet; stamps applied between hands | bingo slip, contract, Heist ledger, Ringer's glass |
| **The choice control** | The merged Big Red Button: a big red mushroom button under a hinged guard (or a brass lever), appearing between hands only, with a 44px+ target | Heist escape, Ringer accusation, Contract signing |

### The card and the inspect screen

- **Card front (extended, not redesigned):** today's card, rarity colour,
  art window and name. Add a **kind glyph** (a small stamp: a spade for
  Straight, a rule book for House Rules, a lit fuse for Madhouse) and a
  **length pip** (one to three notches on a clock). Floor plate later.
  Lab first; the owner signs off the glyphs.
- **Inspect screen, one template for every event:**
  1. the one-sentence rule, big ("Win a pot to pass the bomb.");
  2. the field, length and floor;
  3. prizes, every line (places, bounties, bonuses), and the budget;
  4. "What's different" in three short bullets at most;
  5. anything pre-drawn (the bounties, the prize card, the slip).
- **At the table:** the table intro (`table-intro.js`) gains one beat, a
  placard dropped on the felt with the one-sentence rule, shown for each
  event with rules. Tapped away, or gone after two seconds after the
  first time you've played that event.

### Per event: new assets

| Event | Art and objects | Animation | Sound |
|---|---|---|---|
| High Noon | card art; clock on the board; two drum labels | clock hand strikes; card "draw" slide | bell, gunshot crack |
| Bounty Night | card art; wanted poster (face + price) | rip, fly to bank, staple | rip, staple, ching |
| The Contract | card art; envelopes; red seal; dunk tank | seal stamp; dunk splash | wax stamp, splash |
| The Qualifier | card art; glass case | lid flip, card flight; shutter | glass chime, shutter |
| Hot Potato | card art; bomb with knotted fuse; soot; blast frames | hop arc, fuse burn, sparks, blast | fizz, boom |
| The Trapdoor | card art; hatch in the rail; warning lamp | split, tip, fall, snap shut | ratchet, ka-chunk, whistle, thud |
| Bingo | card art; slip; dabber | peek, stamp, tuck | thump |
| The Heist | card art; vault door, dial, money counter; cabinet lamps | dial spin, counter roll, lamp shift, seat goes dark | clicks, alarm, slide whistle |
| The Ringer | card art; sunglasses overlay; magnifier | unmask flip | sting |
| The Executioner | card art; hooded face (new face set); tall iron seat card; chains | lower on chains; Axe countdown; chains snap, hood falls | drumroll, chain clank, axe thud |
| The Gauntlet | card art; ladder lamps; stamps | stamp and hang | stamp |
| The Big Game | the marquee with three lamps; brass plates; credits | lamp light-up; credits on the CRT | fanfare |

### The art workflow

1. **An art sheet per event** (one paragraph and a palette): the scene,
   the prop, the mood, the family colour cue (Straight: wood and felt;
   House Rules: brass and paper; Madhouse: hazard red and yellow).
2. **Placeholder pixel art first**, in `invitation-art.js`, using its
   existing primitives (bands, dither, chip, card, person, table), plus a
   few new ones (bomb, hatch, vault, poster). Good enough to play and
   judge.
3. **Props in a lab**, phone-first, as the project already does: the
   bomb, the trapdoor, the docket, the choice control. The owner picks
   from two or three variants on the phone.
4. **Pattern Book entry and check** before the part enters the game.
5. **Final art** replaces a placeholder entry when the owner's art is
   ready. Originals go in `art-source/`, game copies in `assets/`.
6. **Reduced motion**: every animation has a still version (a single frame
   and a word), written into the Pattern Book entry.
7. **Small phones**: every lab is checked at 375 × 667 and 430 × 932 with
   the table sweep, which fails on any overlap.

---

## 9. The roadmap

Each milestone is one branch and one pull request, leaves the game
stable, passes `npm test` and the browser checks, and is played by the
owner on the phone before the next starts. Visual parts go through a
phone-first lab link first.

| # | Milestone | What the player gets | Needs | Size |
|---|---|---|---|---|
| **M1** | **The Rulebook + Bounty Night** | Bounty Night with wanted posters; opponents that know the hand limit (sit on a lead, shove late); Career history recorded | the rules module (4 hooks); AI hand-limit and bounty hints; sim probes and per-hand money; history | M |
| M1b | Hot Potato lab (no game change) | a phone link to try the bomb in a game copy | the simulator's rule run for the blast size | S |
| **M2** | **The Trapdoor + High Noon** | the first contraption and the first quick duel | table-piece part; between-hands removal; legal-actions hook | M |
| **M3** | **Antes + Hot Potato + Last Orders** | the bomb; Closing Time's big last hand | antes in the engine (own tests first) | M-L |
| **M4** | **The Qualifier + the album states + repricing** | cards that win cards; SEEN / PLAYED / WON; prices set by the method in Section 7 from M1's history | economy rework | M |
| **M5** | **Bingo + The Heist + the shelf** | two new events; the docket and choice control; Madhouse and Poker Club packets | docket, choice control; packet themes | L |
| **M6** | **The Big Game, House table** | the marquee on the hub; the House table playable as a Seat; Golden Ticket reworked | entry-funded Seat; promotion records | M |
| **M7** | **The Club** | the Club floor, Big Shots packet, The Contract, The Ringer (if its prototype passes), Rematch (if approved) | floor plates; floor scaling | L |
| **M8** | **The Executioner + High Roller** | the first boss; the High Roller floor; THE BIG GAME finale and credits; Golden Reserve | taller seat card; new face set | L |
| M9 | The Gauntlet, then The Madhouse | the multi-stage Legendaries | multi-stage settlement | L |
| Later | Sideshows (In Between first), Find the Ace interlude, Quickfire packet, Short Deck, chip tower prototype | only if prototypes earn it | | |

**Dependencies:** M3's antes before anything that uses them. M4's
repricing after M1's history has a week of data. M6 needs M4's prices.
M7 needs M6 (the House table opens the Club). Quickfire waits for six
Quick events.

### Definition of done, every event

- **Gameplay:** acceptance checks written first; correct rules; AI that
  plays the objective; duration measured.
- **Economy:** simulated with probes; budget test; settles once; reload at
  every point (mid-hand, mid-offer, mid-animation) proven.
- **Presentation:** card art (placeholder at least), inspect screen,
  props, animation, sound, reduced motion, result line.
- **Technical:** unit checks in a suite; a **seeded rule fuzz** (1,000
  simulated events per rule, checking chips are conserved, money never
  exceeds the budget, and settlement happens once) in `npm test`; the
  table sweep at three phone sizes; the play-test.
- **Approval:** a phone-first lab link for any new prop; the owner's
  sign-off; the handover, STATUS and changelog updated; a release.

On process: the existing workflow (acceptance checks, build, an
independent review agent, tests, the real flow on emulated iPhones) is
already the right shape. The only addition is the seeded rule fuzz. More
agent ceremony would cost time without catching more.

---

## 10. Independent critical assessment

I reviewed the first draft as a sceptical player and a sceptical
engineer. What I found, and what changed:

1. **Too many events.** The first draft had fifteen new events. Several
   were the same mechanic in different art: Survivor's Cut and The
   Trapdoor (survive), Contract and Wanted! (hunt one player), Big Red
   Button and Heist (bank or risk). **Changed:** merged to ten new events
   plus two upgrades.
2. **The Ringer may not work at all.** If the timing tells aren't visible
   at real speed on a phone, it's a 1-in-4 guess dressed up as skill.
   **Changed:** it's behind a prototype gate with a pass mark, and it's
   in M7, not earlier.
3. **Hot Potato's blast could be too weak (ignored) or too strong (pure
   avoidance).** **Changed:** the size is set by the bomb-dodger probe in
   M1b, before any art is built.
4. **The economy is calibrated against AI stand-ins**, and we measured
   that the skill dial barely shows in short events. A plan built on
   those numbers could be wrong for the actual human playing. **Changed:**
   M1 records Career history; repricing waits for M4 and real data.
5. **The Big Game's buy-in could feel punishing** if a skilled player
   loses three times to bad luck. **Changed:** promotion is reaching the
   final two, not winning; the lamp needs any three wins on the floor, so
   no card has to be pulled; and other bankroll-risk Seats wait.
6. **Floors multiply content cost** if every event needs a version per
   floor. **Changed:** floors are stakes and opponents only; the album
   keeps one slot per event with floor stamps.
7. **The console is already dense, and new UI could crowd small
   iPhones.** **Changed:** every new object sits on seat cards or in one
   shared docket; nothing new lives permanently on the console; the table
   sweep must pass at 375 × 667 for every milestone.
8. **Engine risk from antes.** Side pots are where poker bugs hide.
   **Changed:** antes are their own step in M3, with side-pot tests,
   before Hot Potato uses them.
9. **The Gauntlet is three coin flips.** **Changed:** hand-limit duels
   with banked stages, simulated before it's built, and moved late.
10. **"Bingo Bastards" as a name.** It's the owner's, and it's funny. It
    will appear on a card and the inspect screen, though. **Kept as
    "BINGO" in this plan**; the owner chooses the final name.
11. **Did I under-serve "ridiculous"?** By M3 the player has a bomb, a
    trapdoor and a western duel; by M5 a vault heist. That's enough
    strangeness early, with the boss and the Madhouse as the headline
    later. **Kept.**
12. **First ten minutes.** In the first draft the starter packet was
    unchanged, so a new player might not see anything strange for an
    hour. **Changed:** once Hot Potato exists, the starter holds Back
    Room, High Noon, Hot Potato and one random Uncommon or better.

### The player's evening, walked through

- **First ten minutes:** the starter packet: Back Room (learn the
  machine), High Noon (a three-minute duel), Hot Potato (a bomb!) and a
  surprise. The inspect screen's one-sentence rules and the table intro's
  placard teach each twist in a breath. The marquee's dark lamps say
  there's something to climb towards.
- **First hour:** two packets bought. The shelf offers House Selection
  and Madhouse (once M5 ships); the player picks the kind of evening.
  They've lost a bomb blast to Tony and fallen through a trapdoor once.
- **A twenty-minute session:** a Quick duel, a Full Madhouse game, and one
  packet opened. Three different experiences, one decision about what to
  play, one about what to buy.
- **The first big achievement:** the House table's lamp lights (three
  wins). They save the buy-in, sit, reach the final two: the Club opens
  with a machine fanfare and a new floor lever. The album shows House
  stamps.
- **The long game:** Club and High Roller editions of favourite events at
  higher stakes against better faces; the Executioner; album pages to
  gild; the Big Game finale and credits; then the plate counting wins.

**Frustrations looked for:** too many rules (one sentence each, at most
two at once); downtime (props animate between hands, never during
decisions, each beat under two seconds and skippable); repetition (four
kinds, three lengths); long animations (budgets in the Pattern Book);
losing a rare card unfairly (a card is only lost by playing it or
abandoning; never by a reload or animation); being forced into a format
(themed packets and the discovery weighting); money with nothing to buy
(the Big Game buy-ins, floors, Golden Reserve).

---

## 11. Final recommendation

### The design in one paragraph

Poker Faces' Career becomes a machine full of strange little tables. Every
card shows its **kind** (Straight, House Rules, Madhouse) and **length**;
every twist is **one rule, one object, one sentence**, and always gives a
good player a decision to make better. The money is honest: short games
pay like the lotteries they are, long games pay skill, and packets come in
flavours of equal value. Above the hub sits **THE BIG GAME**, one marquee
with three tables that also act as the gates between the House, the Club
and High Roller floors. You earn your way there through any events you
like.

### What I'd build first: M1, "The Rulebook + Bounty Night"

1. `js/event-rules.js` with the four hooks Bounty Night needs (`validate`,
   `init`, `afterHand`, `prizeLines`), plus `aiHints`.
2. Opponents that know the hand limit (sit on a lead, shove late), with
   `event-sim.js` proving it (the leader's VPIP falls; the trailer's
   shoves rise).
3. Bounty Night: posters drawn at packet opening, decisive-pot attribution,
   split bounties, the budget test, the wanted-poster table piece (lab
   link first).
4. Career history, recorded for every finished event.
5. The simulator's probes and money per hand.
6. In parallel, no game change: M1b, the Hot Potato lab and its blast-size
   simulation.

Why this first: it proves the rules module on the simplest rule, using
code that already works (K.O. attribution); it fixes a known AI weakness
the owner can feel in every hand-limit event; and it starts collecting the
data the economy needs. Small enough to ship and sign off in one round.

### What I'd reject, and why

| Rejected | Why |
|---|---|
| Three-Hand Dash | Measured: at three hands skill doesn't move the result at all |
| Survivor's Cut as its own event | The Trapdoor does survival with more personality |
| The Big Red Button as an event | Better as the machine's one choice control |
| Chip Jenga (for now) | Most expensive idea; the cheap version is a dice roll |
| Find the Ace as an event | Fun once; an interlude at most, later |
| Omaha, Draw, Pineapple, Stud (in this plan) | Each costs what three Hold'em events cost |
| Sponsored Night, Deep Pockets (from packets) | A payout multiplier and a near-duplicate |
| Luck multipliers (Hot Streak, Lucky Sevens, Mystery Bounty) | Make the measured luck problem worse |
| The Loan Shark, rebuys from the bankroll | Money buying chips edges toward money buying power |
| Eight packets at launch | No dark slots: a packet appears when six events stand behind it |
| A separate finale per floor | One marquee, three tables |
| A big variant or minigame framework up front | Build the first event, add hooks as events need them |

### Decisions for the owner

1. **The taxonomy:** kind (Straight / House Rules / Madhouse / Sideshow) ×
   length, instead of six families?
2. **Hot Potato's redesign:** pass the bomb by winning; the blast is an
   ante?
3. **The Big Game:** one marquee, three tables; lamps at three wins;
   promotion by reaching the final two; a real bankroll buy-in?
4. **Floors** as stakes and opponents only, every kind on every floor?
5. **The Rematch** and an album Faces page (a light touch on parked
   Phase 7)?
6. **Career history** recorded in the save (needed for honest pricing)?
7. **Retiring** Sponsored Night and Deep Pockets from packets (cards
   already owned still play)?
8. **Bingo's name** on the card.
9. **Start with M1?**
