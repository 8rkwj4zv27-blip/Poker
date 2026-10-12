# The card collection (CARDS): brief for a new session

> **Historical.** The collection was designed from this brief as the card album (12 October 2026): see `COLLECTION_BOOK_PLAN.md`, and `HUB_TO_GAME_BRIEF.md` for what's next. Index of current docs: `docs/README.md`.

12 October 2026. A handover to start the collection screen with the
owner. **Talk first; nothing here is decided** except where it says the
owner decided it. The Career hub and the shop are in a good place and are
**not** to be reworked unless the owner says so.

## Where everything is

- **Branch:** `claude/youthful-thompson-8a3zes` (unmerged). It carries
  every hub and shop lab, and the v0.67.1-dev hooks in live files. Build
  on it: start the new session's branch from it, or merge it in.
- **See the hub and the shop:** the packet machine lab (`vending-lab.html`).
  - Claude link: https://claude.ai/artifact/WKWLooBRqQNJGYqfbDf1B1
  - Home screen copy: `packet-machine/` (on `main` only once merged).
- **The hub alone:** `career-main-lab.html`. **The old album:** inside
  `pack-opening-lab.html` (the pack lab; its album door).
- **The live game's Career** is unchanged (six venues, the ticket-reader
  hub). Nothing in this brief is in the game.

## What the hub is now (so the collection fits it)

Full detail in [`CAREER_HUB_BRIEF.md`](CAREER_HUB_BRIEF.md), round 6. In
short: **the tray is the house's, the felt is yours.**

- The cabinet is the bankroll reel and the card feeder. The console is
  SHOP · the middle key · **CARDS**.
- The tray holds the house's three cards, dealt from **your case**
  (`pool` in `js/career-main.js`); REDEAL deals three others.
- Packets from the shop lie on the felt; opened, their cards go face down
  into one deck; tapping the deck runs the pack opening's reveal and you
  put each card down in neat rows. Anything can be moved or thrown.
- **"Into the collection" already happens three ways:** a card thrown off
  the felt (with a two-note chime and a bump on the CARDS key), **ADD TO
  COLLECTION** (every loose card flies into the CARDS key), and the double
  tap that tidies the felt. All three add the card to `pool`, the case the
  house deals from. So today "the collection" and "your case" are the same
  list, and it has no screen.
- **CARDS does nothing yet** (a dull thud). The shop **rolls down** from
  the top on the wheel; the plan has always been that the collection
  **rolls up** from below the same way.

## What a card is (lab only)

`js/event-cards.js`: a card is **one specific table**: a real Career event
plus the opponents drawn for it when the packet was opened, with a rarity
(common, uncommon, rare, legendary) that raises its prize. Four kinds
(table, freezeout, bomb, wild) × four rarities = **16 designs**
(`EventCards.designs()`). Card faces: `js/pack-ritual-cards.js`. **Playing
a card uses it up.** The shared inspect screen (`js/card-inspect.js`) shows
any card big, with a small CRT (where, what, entry, seats).

## What's been said about the collection before

Check each against the owner before reusing it; these are older plans.

- **Packs plan (8 Oct):** "a velvet ticket case: duplicates stack (×2),
  empty slots show what's still out there".
- **Desk plan (11 Oct, decided then):** playing a card uses it up; there's
  no archive of used cards; **the album holds every design you've
  pulled**, and inspecting one shows your history with it (played, best
  finish, won).
- **The hub stills round (11 Oct):** "the collection (later a collector's
  book with category pages) rolls up from below".
- **The owner, this session:** later, pull cards **out of the collection
  onto the felt** (e.g. "dig into our collection and pull out the other
  legendaries"), and keep the table as it is between games (new save
  data, so later and only with the owner's go-ahead).
- **Built once, in the pack lab:** the album: a 4 × 4 grid (kinds down,
  rarities across); found designs show a mini card, unfound show `?` and
  the rarity code; `×n` for copies in your case; tap one to inspect with
  your history. It was a plain screen and has never been reviewed by the
  owner as the collection.

## What the owner has made clear (keep to these)

- **Physical and mechanical, never app-like.** Chunky, tactile, built like
  the Player Dashboard (moulded frame, checker case, sunk bays). The
  packet machine is the bar.
- **Motion must be physically believable** every frame: nothing floats,
  nothing freezes, things land and rest where they would.
- **No levers, no slogans, no instructional labels.** Leave things to be
  learnt.
- **Player agency:** the hub became good when the player got complete
  freedom over the order things happen in. Expect the same appetite here.
- **Rejected before (for the hub and shop; don't bring back):** the props
  desk and its toys, a glass case, a hanging spinner rack, a printed felt
  layout, a cashier window, random chips on the felt, P.I.P. on the hub.
- **Parked:** buy-ins and the economy, venues and "where you are". Don't
  design them into the collection.

## Questions to open the brainstorm with

1. **One thing or two?** Is the collection your case (the cards you can
   still play, which get used up) or an album (every design you've ever
   pulled, kept for good), or both, shown together?
2. **What is it, physically?** It rolls up from below like the shop rolls
   down. Some starting ideas, all untested: a collector's binder of
   sleeved pages, a card-file drawer, a velvet-lined case, a cabinet of
   pigeonholes. Remember the glass case was rejected.
3. **How is it sorted?** By rarity, by kind, by venue, by newest; pages,
   rows or piles; duplicates stacked or loose.
4. **Getting cards out:** pull one (or a handful) out onto the hub's felt,
   to play or arrange. And back in.
5. **What does it show about each card?** The inspect screen already
   carries where, what, entry and seats; the old album added your history.
6. **Saving it:** the collection is a new saved key and a Career save
   migration (`PACKS_PLAN.md`); that needs the owner's approval, and the
   live game's saves and lifetime stats must be preserved.

## How to work with the owner

- When they say "talk me through it", talk; don't build. Turn their
  thinking-aloud into a short plan with the decisions they need to make.
- **Stills first** to compare on the phone, then the moving lab.
- Every lab goes to the phone as a private Claude link (`CLAUDE.md`,
  "Visual labs"): `validation/tools/lab-bundle.js`, publish, give the
  link; republish to the same link after a change.

## Code pointers

- The hub: `js/career-main.js` + `css/career-main.css` (`window.CareerMain`;
  `keyEl('cards')`, `pool`, `collect`, `addAll`, `filed`). The shop and
  the opening run alongside it (`js/vending-machine.js`, `js/pack-opening.js`).
  Map: `docs/CODEMAP.md` (the `career-main-lab.html` and `vending-lab.html`
  sections).
- The shop's roll (`roll()` in `js/vending-machine.js`) is the model for
  the collection rolling up.
- The old album: `renderAlbum`, `albumInspect`, `mini` in
  `js/pack-opening.js`; its styles in `css/pack-opening.css`.
- Touch checks: `node validation/vending-checks.cjs` (a server at the repo
  root on 8765) covers the hub and the shop end to end. `npm test` is
  25/25.
