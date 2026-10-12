# From the labs to the game: brief for the next sessions

12 October 2026. Written at the end of the album session for whoever
picks up next. **Talk first; nothing below is decided** except where it
says the owner decided it. Read `docs/HANDOVER.md` first, as always.

## Where things are

- **Branches (both unmerged, no game change beyond the v0.67.1-dev hub hooks):**
  - `claude/youthful-thompson-8a3zes`: the hub (`career-main-lab.html`) and
    the shop as a vending machine (`vending-lab.html`), plus the hooks.
  - `claude/eloquent-pascal-q7a0be`: all of the above, plus the card album
    (`collection-book-lab.html`). **Start from this one.**
- **The owner's links:** the hub with the shop:
  https://claude.ai/artifact/WKWLooBRqQNJGYqfbDf1B1 · the album:
  https://claude.ai/artifact/USQHuBYFeXwdJDVi8g7HEV
- **The owner, 12 Oct:** "I think we're in a really good place now." Hub
  (round 6), shop and album (round 3) are liked. Don't rework them unasked.

## What's left, as the owner put it

"Design some of the cards, build the events, and start thinking about
adding this career hub into the game", and "improve the inspect mode".
That's three jobs. One session each (`CLAUDE.md`: one job per branch and
pull request), probably in this order:

### 1. The cards and their events

- **What exists:** a card is one specific table: a real Career event plus
  opponents drawn when the packet is opened, with a rarity that raises
  its prize (`js/event-cards.js`). Four kinds (table, freezeout, bomb,
  wild) × four rarities = 16 designs; faces in `js/pack-ritual-cards.js`.
  Playing a card uses it up.
- **Open (the owner said so in the album session):** how cards are
  organised and split into categories; whether one card comes in several
  rarities; so how the album's pages are laid out.
- **Careful:** the owner **parked buy-ins, the economy and venues** (handover,
  "Parked"). Building events touches all three, so ask what's unparked
  before designing prizes or entries. Events Release 1 is live (v0.67.0,
  `EVENTS_PLAN.md`); Releases 2 to 4 were to be reshaped around packs.
- **Start:** stills of card faces to compare on the phone, then the event
  list behind them.

### 2. The inspect screen

- **What exists:** one shared screen, `js/card-inspect.js` +
  `css/card-inspect.css`, used by the hub, the album and the pack opening:
  the card big, a small CRT (where, what, entry, seats), ◄ BACK ►, flick
  sideways for the next, flick up to the reader, flick down to put back.
- **Open:** what the owner wants better: ask first. Waiting on it: the
  card's history (played, best finish, won), which the album was to show.
- It's shared, so a change shows in all three labs; re-stage each one.

### 3. The hub into the game

The big one. **Plan it with the owner before building** (`CLAUDE.md`).

- It replaces the live Career hub (the ticket reader). Saves and lifetime
  stats must survive (`js/save-data.js`, "Preserve existing localStorage
  settings and lifetime statistics").
- **Needs the owner's approval:** the collection's saved key and the Career
  save migration (`PACKS_PLAN.md`); keeping the felt as you left it between
  games (new save data).
- **The real table hand-off:** PLAY currently wheels to an empty table in
  the album lab (`wheelToTable`, `machineWheelRig`). The live path is
  `careerDepartToTable(launch)` in `js/machine-wheel.js`.
- **Housekeeping that comes with it:** a release (`BUILD_VERSION`,
  `CACHE_NAME`, `?v=` tags, `CHANGELOG.md`); remove the unused v0.67.1 hub
  hooks; Pattern Book sign-off for the new parts (the book, the vending
  machine, the inspect screen) before they're in the game; update
  `docs/career/STATUS.md`, whose "Immediate next task" is out of date
  (it still names the Pack Ritual lab); archive labs whose features ship.
- Run `npm run play-test` before merging, as for any player-facing change.

## Album choices still to confirm

The owner liked round 3 but didn't pick between the lab's options:
ARRIVAL (LIFT or THROW, default THROW), TURN (FLAT or CURL, default
CURL), CORNERS or SLEEVES (default SLEEVES). Ask before building them in.

## Known

- `validation/vending-checks.cjs` fails now and then at "the rest added"
  (the 375x667 run); it does the same without the album's changes.
- The curl turn draws twelve copies of the page while it turns: watch it
  on a real phone.
