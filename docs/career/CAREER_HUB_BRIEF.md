# The Career hub: brief for a rethink

12 October 2026. A handover for a fresh session to brainstorm the Career
hub (the home screen of Career) with the owner. It gathers what has been
built, what the owner kept and rejected, and the open questions. The shop
(the packet machine) is in a good place and is **not** part of the rethink
unless the owner says so. Nothing here is in the game yet.

## Where everything is

- **Branch:** `claude/gifted-pascal-351dm7` (unmerged). It carries all the
  hub and shop lab work, and the v0.67.1-dev hooks in live files
  (`js/dealer-deck.js`, `js/coach-set.js`, `js/coach-talk.js`, `sw.js`).
  Those hooks change nothing at the table, and the play-test passed on 11 Oct,
  but merging them is a release. Earlier work came from
  `claude/trusting-mayer-4omex1`.
- **To see the current hub and shop:** the packet machine lab
  (`vending-lab.html`). The hub is what loads; SHOP rolls the machine in.
  - Claude link: https://claude.ai/artifact/WKWLooBRqQNJGYqfbDf1B1
  - Home screen (on `main`, a self-contained copy in `packet-machine/`):
    https://8rkwj4zv27-blip.github.io/Poker/packet-machine/
- **Older links (stale, kept for reference):** the hub on its own,
  `career-main-lab.html`, at https://claude.ai/artifact/FpUrE7DTH5uqFqhV4eC8ir
  (last published before P.I.P. was removed); the rejected props desk,
  `career-hub-lab.html`, at https://claude.ai/artifact/UdbYubPDiABddKThhANX4k;
  the pack opening, `pack-opening-lab.html`, at
  https://claude.ai/artifact/2A5hyH5pufRp7Tdj513SQp.
- **The live game's Career** is unchanged: six venues, the ticket-reader Hub
  (v2), buy-in feed, Table Intro and end screens (`docs/career/STATUS.md`).

## The direction this sits in

Career is moving to **packs of event cards** (`PACKS_PLAN.md`, 8 Oct):
you buy (with bankroll chips) or earn sealed packets, open them yourself,
and the cards inside are the events you play. Decided with the owner:
packs are bought with chips and earned by cashing or winning; never
microtransactions or a second currency; progress is protected (winning a
venue guarantees its next key card; the Back Room's HOUSE cards and the
cash table never run out).

What the hub is for, most used first (from the desk plan, still the best
statement of it): pick tonight's game and play it in two taps at most;
see where you are (bankroll, venues reached); buy packets (the shop); look
through the collection; leave and settings.

## How the hub got here (each round, and the owner's verdict)

1. **Hub Lab ticket rack** (`hub-lab.html`, 8 Oct): Career opens on
   tonight's tickets in a rack. Superseded.
2. **The props desk** (`career-hub-lab.html`, `CAREER_HUB_DESK_PLAN.md`):
   a felt desk with three suggested cards on a brass lip, matchbooks for
   venues, a banker's lamp, a brass bell, a filing case, chip taps and a
   hatch shop with gold ticket plates. **Rejected, all of it.**
3. **Stills A to D, E to H, still 3** (`hub-stills-lab.html`): the owner
   picked a **plain card slot** in the cabinet, exactly a card wide; a
   **slim** cabinet row (CRT · slot · CRT, as tall as their content, the
   two screens aligned on one grid); the **bankroll reel full width**; the
   deck alone in the bottom-left corner. No rake, no lever.
4. **Moving hub** (`career-main-lab.html`): the table's own dealer deck
   deals cards that land at random and pile up; drag to arrange, tap to
   inspect, drag into the slot to feed (it ratchets in); PLAY pays the
   entry. Live CoinWorld chips on the felt were tried and **dropped** ("felt
   random"). **P.I.P. was added** (tap for remarks and stats, throw him) and
   then **removed** ("he just takes up space").
5. **With the shop** (`vending-lab.html`, rounds 1 to 4): the hub gained
   the clean-up spot, one table size, cards left on the felt after
   opening, wrappers and a bag of chips as things on the felt.
6. **The wooden tray, stills** (`hub-tray-lab.html`, 12 Oct, this brief's
   session; retired once built, in git history on
   `claude/youthful-thompson-8a3zes`):
   https://claude.ai/artifact/XTx3Xf8Web82Nc6BQNRw8H. The owner's direction after a brainstorm (other
   games compared; the table-as-hub, jukebox, faces-first, split-flap and
   empty-felt ideas all turned down):
   - A clean felt; in its top third a small rectangular wooden tray with a
     stitched seam, three cards laid in it, named **REGULAR · STEP UP ·
     BIG ONE**. No visible deck, no clean-up spot, no CRTs (the cabinet is
     the reel and the feeder).
   - The middle key is **REDEAL** (free, unlimited): the three are swept
     off screen and three more tossed in. Tap a card to inspect it; swipe
     it up into the feeder; the middle key reads **PLAY** to accept it.
   - After the shop the tray holds the **packets** to open instead of the
     cards. An opened packet's cards lie piled on the felt and the middle
     key reads **ADD** (after each packet): they're gathered into the
     collection. No wrappers, strips or bags left on the felt.
   - **Parked by the owner:** buy-ins and the economy, venues and "where
     you are": the hub is only the tickets for now.
   - The stills (TUNE): the hand, a card in the feeder, packets waiting,
     an opened packet; inlay or sunk tray, burnt names or paper tags.
   - **The owner's pick (12 Oct):** no names at all, a plain neat wooden
     table, no stitched edging round it, the soft bevel kept. Build it as
     the Career hub: cards moved by holding and dragging (with shadows),
     a double tap puts everything back; any number of packets lie on the
     table in one overlapping row. Built in `career-main.js` the same day.

## The hub as it stands (in `vending-lab.html` and `career-main-lab.html`)

- **Cabinet:** the bankroll reel full width; under it the feeder (a plate
  over a mouth a card wide), nothing else.
- **Felt:** in its top third a small wooden table (the rail's wood, a soft
  bevel); the rest is open felt.
  - **Three cards** lie on the table, chosen from your case (one from the
    cheapest third, one from the middle, one from the top; unlabelled).
    **REDEAL** sweeps them off to the right and tosses three more in from
    the left.
  - **Anything on the felt** can be pressed and dragged about: it lifts and
    its shadow drifts; let go and it slides and settles. **A double tap**
    on the felt puts everything back in its place.
  - **Tap a card** to inspect it; **flick it up** there (or drag or flick it
    up from the table) and it goes half into the feeder: the plate reads
    it, the middle key reads **PLAY**. Tap the card and it comes back out.
    PLAY takes it in: it's used up, another is tossed into its place (the
    game would seat you here: not wired; no buy-in).
  - **Back from the shop** the cards are swept away and the packets you
    sent lie on the table, one to a place, more in one overlapping row.
    Tap one (or **OPEN**, the top one) and it's opened on the felt (the
    pack opening, embedded); its chips count into the reel, the wrapper
    and strip fall away, its four cards lie in a heap: **ADD** files them
    into your case (into the CARDS key). Then the next packet, or three
    cards again.
- **Console:** SHOP · REDEAL / PLAY / OPEN / ADD · CARDS. SHOP rolls the
  machine down (LEAVE · HOLD TO BUY · TAKE). CARDS does nothing yet (the
  collection, unbuilt).

## What the owner has made clear (keep to these)

- **Physical and mechanical, never app-like.** Chunky, tactile, built like
  the Player Dashboard (moulded frame, checker case, sunk bays). The
  packet machine is the bar: the owner loves it.
- **Motion must be physically believable**, every frame: no frozen or
  parked frames, nothing floating, things land and rest where they would.
- **No levers, ever.** No slogans or instructional labels ("THE HOUSE
  ALWAYS DEALS", "IF IT STICKS, THUMP IT"); leave things to be learnt.
- **Rejected outright:** the props desk and its toys, the hatch shop with
  gold ticket plates, a glass case, a hanging spinner rack, a printed
  felt layout, a cashier window, random chips on the felt, P.I.P. on the
  hub, rakes and levers to re-deal.
- **How to work with the owner:** when they say "talk me through it",
  talk, don't build. Stills to compare on the phone before anything moves,
  when exploring. Every lab goes to the phone as a Claude link (and now
  the home-screen copy). The owner thinks aloud; turn their ideas into a
  short plan with the decisions they need to make.

## Open questions for the brainstorm

- Is a **felt of loose cards** the right picture for "pick tonight's game",
  or does it bury the two-tap goal? (The owner is unsure about the hub now.)
- How do the **deck, the case and the collection** relate: what is the
  deck, what is on the felt, what is CARDS?
- **Where you are:** venues reached and progress have no home since the
  matchbooks went.
- **PLAY into a real table:** the live game already has the ticket feed,
  buy-in roll and Table Intro; how much of the live ticket-reader Hub
  survives?
- **The collection** (CARDS, rolling up from below; once a collector's book
  with category pages) is unbuilt.
- How the hub and the shop share the space (the shop takes the screen row
  and the felt; the reel and console stay).

## Code and checks (for whoever builds next)

- `js/career-main.js` + `css/career-main.css`: the hub (`window.CareerMain`:
  `layDown`, `countIn`, `raise`, `scale`, `keyEl`, wallet; the clean-up is
  `cleanUp`). `js/vending-machine.js` + `css/vending-machine.css`: the shop
  and the things on the felt (`window.CareerShop`). `js/pack-opening.js`
  runs embedded (`PackOpeningEmbed`). Details in `docs/CODEMAP.md`.
- `docs/career/VENDING_PLAN.md`: the shop's rounds and open items.
- Touch checks: `node validation/vending-checks.cjs` (a server at the repo
  root on 8765). `npm test` was 25/25 at round 3.
- The home-screen copy: re-stage `packet-machine/` on `main` from the lab
  bundle (`validation/tools/lab-bundle.js`) through a pull request.
