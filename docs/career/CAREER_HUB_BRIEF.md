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

## The hub as it stands (in `vending-lab.html`)

- **Cabinet:** the bankroll reel full width; under it CRT · plain slot ·
  CRT (IN HAND / PLAYED, or ENTRY / READY with a card fed).
- **Felt:**
  - The table's own deck, bottom left. Tap it for a card, which lands at
    random, on top of whatever's there, and turns over. The first three
    after a shuffle are chosen for a reason (the safe one, the step up, the
    stretch) but never labelled. The deck's thickness shows the case left.
  - The **clean-up spot**, bottom right: a faint printed card outline. Tap
    it and every card slides in, squares up, goes back into the deck, and
    the deck is shuffled by hand. It also clears the shop's things: the
    chips and any shut bag count into the bankroll, the rubbish goes.
  - Cards: drag to arrange, tap to inspect (the shared inspect screen),
    drag up into the slot to feed it; PLAY then pays the entry (the game
    would seat you here: not wired).
  - Packets bought in the shop wait in a **pile** on a clear patch; tap
    one and it's **opened on the felt** (the pack opening, embedded):
    tear, pull the cards, reveal four, the hand is read as a poker hand,
    then the four are **laid down among the other cards**. The empty
    **wrapper** (ripped seam) and the torn **strip** stay as things to push
    about or throw off the edge. The chips come in a clear **bag** with the
    amount on a sticker: snip its corner and they spill; tap one, it bounces.
  - One table size: packets, opened cards, wrappers and bags all match the
    hub's cards.
- **Console:** SHOP · PLAY · CARDS. SHOP rolls the machine down over the
  screen row and felt (the console then reads LEAVE · HOLD TO BUY · TAKE).
  CARDS does nothing yet ("rolls up": the collection, unbuilt).

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
