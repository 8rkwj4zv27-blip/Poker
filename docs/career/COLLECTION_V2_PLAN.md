# Collection & Card Handling V2

Stage One of the Career Expansion Campaign. Written 23 October 2026
against `main` at v0.71.0. **Status: design proposal, awaiting the owner.
Nothing is built.** It comes before the events in
[`EVENT_EXPANSION_V1.md`](EVENT_EXPANSION_V1.md): the collection is made
excellent first, then filled. V1's milestone M1 (the album record and
look) is absorbed into this plan; V1's event milestones follow it.

---

## A. Current-state audit

Read from the code, not the plans: `js/collection-book.js` (the album),
`js/card-inspect.js` (the card object and inspect screen),
`js/career-main.js` (the hub's felt, tray and feeder),
`js/pack-opening.js` (the opening and reveal), `js/career-link.js` (how
the album reads the save), and the Pattern Book.

### What exists and works

- **One shared card object** (`CardInspect.make`): face, back, a fold
  flap, a thickness edge and a shade, on the opening's physics body. The
  same object appears in the opening, the album, the felt and the
  inspect screen. That's the right foundation, and V2 keeps it.
- **Rarity finishes on the face** (`css/invitation-cards.css`): cream,
  green, blue with a silver edge and a lacquer sheen, gold foil with
  engraved rays. The face already exposes `--sheen-x` and
  `--light-strength` for a light that moves with the card.
- **A tiered reveal already exists** in the opening: tap or flick to turn
  a card, hold to squeeze the corner, a glint for Rare and better, a slam
  and CRT flourish for a Legendary.
- **The album is a real object**: a leather book thrown onto the table
  with a thud and dust, a cover you drag open, pages that curl in stepped
  frames, numbered tabs that riffle, cards in plastic sleeves that catch
  and slide. The owner liked it ("looking really good", round 2).
- **The felt and tray**: cards can be pulled out, slid about, thrown;
  the tray keeps up to 12 (saved); the felt holds up to 20; a card goes
  into the feeder and only **PLAY** starts the event. Two deliberate
  steps, so accidental entry is already hard.
- **Inspect**: the card rises from where it was, the house dims, a drawer
  with a small CRT rises below; swipe sideways for the next card on the
  page, tap for a half turn, flick down to put it back, flick up to send
  it to the feeder.

### What feels awkward, and why (verified)

1. **Pulling a card onto the felt sends the book away completely**
   (`handOff()` calls `putAway()`). Bringing it back **resets it to
   page 1, cover closed** (`bringUp()` sets `cur = 0` and shows the
   cover). Each extra card means: CARDS, wait for the throw, drag the
   cover, find the page, hold, carry. That's the problem the owner hit.
2. **The book is thrown and slammed every time**, with the cabinet
   shaking. Delightful once; a tax on the tenth visit.
3. **Five pages for ten events**: page 1 is full, page 2 has one card,
   pages 3-5 are always empty. The numbered tabs (1-5) mean nothing.
4. **The album can't tell found from not found.** It shows *every*
   catalogue event: bright if you hold a card, dimmed if you don't
   (`albumPages()`). There's no record of discovered, played or won, so
   there's nothing to hunt and nothing to complete.
5. **Copies are invisible.** The data knows how many you hold
   (`count`), but the pocket shows one card either way.
6. **The inspect card is a 2D trick.** It narrows (scaleX) and skews in
   6° steps with stepped shading. It reads as "pixel sprite turning",
   which suits cards flying on the table, but it can't tilt, show its
   thickness properly or catch the light the way the owner now wants.
7. **The inspect screen says little.** The CRT shows two or three lines
   (where, entry and seats, second prize). No one-sentence rule, no
   length, no opponents, no record, no count of copies.
8. **Nothing in the opening knows what's new.** A tenth Back Room gets
   the same reveal as your first Legendary.
9. **Winning doesn't come back to the album.** The hub's plate says
   `1ST · +$60`, and that's the end of it.
10. **Loose cards on the felt aren't saved** (only the tray is). That's
    harmless (they're still in your collection after a reload), but a
    player could expect their spread to persist.

### What must be preserved

Invitation definitions and art; rarity colours and finishes; card
ownership and consumption; save compatibility; the throw, the cover, the
sleeves and the curl (as options, not every time); the feeder's two-step
PLAY; all poker.

---

## B. Creative direction

**A collector's book and a jeweller's loupe, inside a velvet machine.**

The PS2-era feeling the owner describes comes from three things, and
each has a Poker Faces version:

| The old-game feeling | How Poker Faces does it |
|---|---|
| A ceremony for the *first* time only | The machine knows what's new. First finds get a sting and a stamp; repeats are quick |
| The object presented like treasure | The card rises into a lamp's light, turns slowly, and its material answers the light: paper, satin, lacquer, foil |
| A permanent, visible record | Rubber stamps, punched holes and gilt in a real book, not progress bars |

**Materials, by rarity (unchanged colours, richer light):**

- **Common: matte card stock.** A soft diffuse shade only; the light
  slides gently across it. No shine.
- **Uncommon: satin.** A broad, soft highlight.
- **Rare: lacquer.** A narrow, bright specular streak that runs across
  the card as it turns, with a clear-coat edge.
- **Legendary: gold foil.** The foil areas (title, rays, prize) catch the
  light separately from the paper: gold and warm white only. No rainbow
  holo, no particles at rest.

**Motion:** smooth and weighted for the object you're holding (a spring
that follows your finger and settles with a small overshoot); stepped
pixel motion stays for things flying across the table, as the Pattern
Book says. The lab tests both for the inspect card (Section D).

**Sound:** short, mechanical and musical: a three-note chime for a new
find, a fuller sting for a Rare, a fanfare for a Legendary; a rubber
stamp's thump; a page's flap; a brass clack for gilt corners. All on the
game's sound switch.

---

## C. The discovery ceremony

### Five levels, by what's actually new

| Situation | What happens | Extra time |
|---|---|---|
| **Duplicate** (already discovered) | Today's reveal, quickened. A small "×2" tally ticks on the CRT | none (faster than today) |
| **Discovered, not yet conquered** | As a duplicate, plus one CRT line: NOT YET WON | none |
| **New Common or Uncommon** | The card turns into the lamp's light; a punched **NEW** ticket stamp clicks into its corner; three-note chime; CRT: NEW EVENT REGISTERED | about 0.8 s |
| **New Rare** | As above, then the card makes one slow three-quarter turn so the lacquer streak runs across it; fuller sting | about 1.5 s |
| **New Legendary** | Today's Legendary slam, then the house lights dim, a single spotlight, the card turns slowly and its foil catches the light; a fanfare; CRT: LEGENDARY DISCOVERED | about 2.5 s |

**Never repetitive:** the ceremony belongs to the *first* time an event is
found, so it can only happen once per event (about 16-25 times in a whole
Career). **Always skippable:** any tap jumps the ceremony to its end
state. A setting offers FULL or SHORT.

**Collection achievements** (a section complete, the whole catalogue
found, a Legendary conquered) happen in the album, not in the packet.
That's where they belong, and it keeps openings short.

### Connecting the packet to the book

- After an opening with new finds, the **CARDS** key gets a small lit
  counter: **NEW 2**.
- Opening the book then goes **straight to the first new card's page**,
  its pocket lit; a tap on the counter steps to the next new one.
- The NEW stamp stays on a card's pocket until you've inspected it once.

---

## D. Inspection V2

### Three approaches

**1. THE LOUPE (recommended).** The card rises from its pocket or the
felt into the upper half of the screen, under a lamp, and turns slowly.
Below it, the existing drawer grows into a proper **readout**: the CRT
with four tabs on brass keys: RULES, PRIZES, TABLE (the opponents' faces
from the card's roster), RECORD (discovered / played / conquered, copies
held). The card is never covered and never carries small text it doesn't
already carry.
- *For:* artwork stays the hero; information is readable and still; it
  reuses the drawer, the CRT and the key bay; it works the same in the
  opening, the album and the felt.
- *Against:* two things to look at.

**2. THE BACK IS THE RULE SHEET.** Flip the card and its back carries the
rules, prizes and record, printed like a trading card's reverse.
- *For:* one object, very physical.
- *Against:* the back is the card's identity in packets and the deck
  (the crest); small text on a turning card is hard to read and goes soft
  under 3D transforms; nowhere to show the opponents' faces well.

**3. THE MUSEUM LABEL.** The card stands upright on a small brass stand,
with a paper label sliding out beneath it.
- *For:* charming.
- *Against:* the label is a second paper object, smaller than the CRT,
  and it duplicates what the drawer already does.

**Recommendation: the Loupe**, with one idea borrowed from approach 2:
the card's **back shows its record** as marks on the crest (a punched
hole for played, a small gold stamp for conquered), so flipping it is
rewarding without making it a rule sheet.

### The object

- **Real CSS 3D.** The card becomes a box with depth: the face, the back,
  and thin edge slabs (cream stock with a dark core) in a `preserve-3d`
  group. A shadow element on the table plane shifts and softens with the
  tilt. No WebGL.
- **Light** is a set of gradient layers on the face, moved by
  **transform** (never by repainting backgrounds): a diffuse shade for
  every card, plus the rarity's highlight (satin band, lacquer streak, or
  the masked foil layer). Their position comes from the card's angle.
- **Drag to rotate:** the card follows your finger in yaw and pitch on a
  spring; release and it carries its momentum, then settles to the
  nearest face with a small overshoot. A flick spins it. A tap turns it
  over.
- **At rest:** a slow sway of a few degrees (off with reduced motion),
  returning to dead flat whenever you're reading the readout, so the art
  is crisp.
- **Rises from where it was** (pocket, felt, opening) and goes back there,
  as today.

### The pixel-sharpness question (the biggest technical risk)

The game keeps pixel art crisp by scaling in whole steps and moving in
stepped frames. Smooth 3D rotation fights that: iOS Safari rasterises a
3D layer and can soften it while it turns. The plan:

- Draw the card at its **final on-screen size** (no scaling up a small
  layer), and let it settle to exactly flat and whole-pixel at rest.
- **The lab offers SMOOTH and STEPPED rotation** (stepped: 12-15 poses a
  second, like the deal styles) on the owner's phone. If smooth looks soft,
  stepped keeps the craft and still feels like an object.
- Avoid CSS filters on anything that moves (the hub's earlier shimmer bug
  on iOS was exactly that, `STATUS.md` item 2).

### What the readout says

| Tab | Shows |
|---|---|
| RULES (default) | The one-sentence rule, then players, length (with the clock pip), and the event's kind |
| PRIZES | Every paid place, the chip bonus, any bonus lines |
| TABLE | The roster's faces and names, from the card |
| RECORD | DISCOVERED (date), PLAYED, CONQUERED; copies held; on the felt or the tray |

Keys under the readout: **TO THE FELT** (Section F), and the existing
flick up to the feeder.

---

## E. Album V2

### Keep

The leather book, the cover, the sleeves, the curl, the tabs, hold to
pull out, tap to inspect. These are good and signed off.

### Change

1. **Organise by section, not by number.** Brass-edged divider tabs by
   kind: **STRAIGHT**, **HOUSE RULES**, **MADHOUSE**, and a gilt
   **LEGENDS** section at the back for Legendaries. Within a section,
   Commons first, Legendaries last. A section shows as many pages as it
   needs; no empty pages beyond its own mystery pockets.
2. **A contents page first** (the inside cover): the sections with a
   printed tally each ("MADHOUSE 3 OF 5 FOUND · 1 WON"), like a
   collector's checklist. Tap a section to riffle there. This is the
   progress view: printed counts, not bars.
3. **Bigger pockets: six per page** (two across, three down) instead of
   nine. At 82 × 120 on a phone, nine pockets make the art too small to
   enjoy. Six pockets at about 1.3× fit the same page and make browsing a
   pleasure. (Lab compares 6 and 9.)
4. **Copies:** a pocket holding several cards shows the edges of the ones
   behind (up to three offsets) and a small brass tag: **×3**. Taking one
   out leaves the rest.
5. **Used up but recorded:** an empty pocket shows the event's **ghost**
   (the printed outline of the card in faint ink on the pocket paper) with
   its stamps. You know what you've found, and that you need another to
   play it.
6. **Arrival:** the throw-and-slam for the **first** opening per visit to
   the hub; after that the book lifts in quickly and **comes back open, at
   the page you left**.
7. **Performance first:** page turns stay under 300 ms, the curl keeps its
   stepped frames, and nothing animates while you aren't touching it.

### Undiscovered events: three treatments for the lab

| Treatment | What you see | Hint level |
|---|---|---|
| **Sealed pocket** (recommended) | The pocket holds a plain sealed paper slip with a wax seal in the rarity's colour, and one printed line: "A MADHOUSE GAME · RARE" | Rarity and kind |
| **Silhouette** | The card's frame in its rarity colour, the art window blacked out to a dark silhouette of the scene, the title as dashes | Shape of the art |
| **Frosted sleeve** | The card behind a frosted, dithered sleeve: colours and shapes, no detail | Colours |

Recommendation: **sealed pocket.** It's the most physical and the most
mysterious, and it says enough to want it without spoiling the art. Not
a question mark.

---

## F. Card handling: pulling several cards out

### The flow

1. Open the book; it comes back at the page you left.
2. Hold a card: it comes out of its sleeve into your fingers (as today).
3. Carry it past the book's edge: **the book lowers to a dock**, sliding
   down until only its top edge shows above the console, still open at
   the same page, so the whole felt is clear.
4. Let the card go anywhere on the felt (or the tray, or the feeder).
5. **The book rises back** to where it was (about 250 ms), same page,
   same scroll. Pull out another.
6. Close the book with CARDS (or a tap on its dock) when you're done.
   The cards on the felt stay where you put them.

This is a small change to what exists: `handOff()` docks the book
instead of putting it away; `bringUp()` stops resetting the page.

### Also

- **Tap to place.** The inspect readout's **TO THE FELT** key sends the
  card to the next tidy spot on the felt; the book stays open. Good for
  anyone who doesn't like long-press dragging.
- **Duplicates:** each pull takes the next free copy (`freeCard()` already
  does); the pocket's ×3 tag counts down; when every copy is out, the
  pocket says ON THE TABLE (as today).
- **Limits:** the felt's 20 and the tray's 12 stay. The felt-full message
  appears on the plate as now.
- **Arranging:** cards on the felt can be moved and thrown as today. No
  stacking system: a card dropped on another just lies over it.
- **Inspecting from the felt:** tap a felt card, as now; the Loupe opens;
  closing it puts the card back where it lay.
- **No accidental entry:** only the feeder plus PLAY starts an event
  (unchanged).
- **Ownership:** unchanged: cards on the felt and tray are still yours;
  only PLAY uses one up, in the same save write that starts the event.
- **Coming back from an event:** the hub restores the tray (saved) and the
  felt cards still in this session. If you won, the CARDS key shows a
  **STAMP** lamp (Section G).

---

## G. Collection progression

### The record

`career.album[eventId] = { found, played, won }`: each a date, or
absent. It lives inside the new Career's existing save (no new saved key,
no save-version change), and is written **in the same save write** as
the thing it records:

| Mark | Written when | Code that already does the write |
|---|---|---|
| DISCOVERED | a packet is opened (its cards become yours) | the opening's one write |
| PLAYED | the card is used to start the event | the play's one write |
| CONQUERED | the event settles as an outright win (a shared 1st is a cash, not a win, as today) | `settleCareerEvent()` |

Plus `career.fresh`: the card ids that were the **first of their event**
when opened, so the NEW stamp survives a reload, and is cleared once each
is inspected.

### Old saves: no invented history

- An event is **discovered** if you hold a card of it now, or an event of
  it is in progress.
- **Played** if an event of it is in progress.
- **Conquered** only if the save's last result (`career.lastResult`) is
  an outright win of that invitation event.
- Nothing else is guessed. An event you played and won last week, with
  no card left, starts unrecorded, and the album says so plainly once:
  "Records start today."

### The stamps

| Mark | In the album | On the card's back |
|---|---|---|
| Discovered | the card (or its ghost) in the pocket | (nothing) |
| Played | a punched hole in the pocket's corner, like a used ticket | a punched hole |
| Conquered, Common/Uncommon | a red rubber stamp, CONQUERED, slightly askew | a small red stamp |
| Conquered, Rare | an embossed gold seal | a gold seal |
| Conquered, Legendary | the gold seal and a silk ribbon tucked into the pocket | the seal and ribbon |

**Applied live, once:** after a win, the CARDS key shows a **STAMP** lamp;
opening the book goes to that event's page and the stamp thumps down in
front of you. (A reload before then still shows the stamp, just without
the moment.)

### Completion

- **A page complete** (every event on it conquered): brass corner pieces
  clack onto the page.
- **A section complete:** its divider tab turns gilt, with a short brass
  fanfare.
- **The whole catalogue found / conquered:** the book's cover gains a
  gold-tooled edge and the spine's lettering is gilded.
- All cosmetic and permanent. No XP, no levels, no currency, no money.

---

## H. Technical feasibility

### Rendering

- **Inspect card:** CSS 3D (`perspective`, `preserve-3d`, edge slabs),
  gradient light layers moved by `transform`; one 3D card on screen at a
  time. Faces stay the existing SVG pixel art.
- **Album:** today's DOM book; pockets drawn as now; stamps are small SVGs
  laid into the pocket. The curl keeps its stepped strips. Six pockets per
  page means fewer SVG faces in the DOM than today's nine.
- **Discovery:** extends the opening's existing reveal steps
  (`revealNext`, the Rare and Legendary branches); no new animation
  engine.

### Animation

The existing physics and tweens (`PO.Body`, `tween`, `glide`, `squash`)
cover everything. The one new piece is a small spring for the inspect
card's yaw and pitch (a few lines, in `card-inspect.js`).

### State

- Authoritative: `career.album`, `career.fresh`, written only by the
  Career's transaction code (`07-ui-wiring.js` and `career-link.js`),
  each in an existing save write.
- Presentation reads it and never writes. The stamp moment and the NEW
  lamp are derived from the record.
- Validation on load: damaged entries are dropped without touching the
  rest (the same rule as the cards).
- `SaveData.KEYS` is unchanged: the record lives inside
  `felt.career.new`, which backups already copy whole.

### Performance on iPhone

| Risk | Check |
|---|---|
| A 3D-transformed card softening the pixel art | the lab's SMOOTH vs STEPPED comparison on the owner's phone |
| Moving light layers repainting every frame | move them by `transform` only; Safari's paint flashing in the lab |
| The page curl on smaller phones | the lab's frame-time readout at 375 × 667 |
| Too many inline SVG faces | six per page; pages built on demand |
| Memory | one inspect card, one open page plus its neighbours |

Reduced motion: no sway, no slow turns, the ceremonies collapse to the
stamp and the sound; page turns cut. Sound off: everything still reads.

### What changes in which file

`collection-book.js` (dock, page memory, sections, pockets, stamps,
ghosts, sealed pockets), `card-inspect.js` (3D object, readout tabs, TO
THE FELT), `career-main.js` (dock hand-off, NEW and STAMP lamps),
`pack-opening.js` (NEW stamp and ceremony levels), `career-link.js` and
`07-ui-wiring.js` (the record), their stylesheets, the Pattern Book.
No new dependencies.

---

## I. Production roadmap

Labs first, in the game copy, on the phone, per `CLAUDE.md`. Each lab is
a private link with a TUNE sheet for the options marked above.

| # | Milestone | Kind | Delivers | Gate |
|---|---|---|---|---|
| **C1** | **Pull many** | lab, then game | the dock; the book remembers its page and comes back open; quick arrival after the first; TO THE FELT | owner tries the lab; then a small release |
| **C2** | **The Loupe** | lab | the 3D card (SMOOTH / STEPPED), the four materials, drag and spring, the readout with four tabs, card-back record marks | owner picks motion and materials on the phone |
| **C3** | **The record** | game (data) | `career.album` and `career.fresh` written in the existing save writes; old saves backfilled honestly; tests. No visual change yet | tests; independent review |
| **C4** | **Album V2** | lab, then game | sections and contents page; six pockets (vs nine); copies; ghosts; sealed pockets (three treatments to pick from); stamps and the live STAMP moment; completion gilt | owner picks treatments; then a release |
| **C5** | **Discovery** | lab, then game | the five ceremony levels; NEW lamp and stamp; the packet-to-book link; FULL / SHORT setting | owner signs off; release |
| **C6** | **The Loupe in the game** | game | C2's choices in the opening, album and felt | release |

**Dependencies:** C1 stands alone. C3 before C4 and C5 (they show the
record). C2's motion choice before C6. C4 and C5 can share a lab.

Each release: `npm test`, the browser checks (with the tray scenario
extended to pull three cards in a row and reload), the table sweep at
three phone sizes, real touch in the emulated iPhone, the owner's sign-off
on the phone, the Pattern Book updated (the inspect card's motion, the
dock, the stamps, the pockets).

After C6, the event expansion starts with Three Strikes, born with its
album pocket, its sealed slip and its stamp.

---

## J. Independent critique

1. **Spectacle that repeats becomes friction.** The book's throw is the
   clearest example today. Fixed by a rule for everything in this plan:
   **big moments happen once** (first find, first win, first completion);
   everyday actions (opening the book, pulling a card, opening a
   duplicate) get faster than today.
2. **A turning card is hard to read.** That's why the information lives
   in the still readout, and the card goes flat while you read.
3. **Smooth 3D may soften the pixel art.** The lab tests it on the real
   phone before anything is built; STEPPED is a real fallback, not a
   compromise.
4. **Sections can look empty with a small catalogue.** Ten events across
   four sections, with Legends holding one. Sealed pockets fill the gaps
   with promise, and a section only exists once it has at least one
   event.
5. **Mystery pockets could frustrate** if the player can't tell what's
   missing or where to find it. The slip says the kind and rarity, which
   points at the right packet once themed packets exist.
6. **The dock could be fiddly** if the book rises back while you're still
   arranging cards. It rises only when the card is let go, and a tap on
   the docked edge brings it up too; the lab tests both.
7. **Six pockets means more pages.** Better than tiny art, but the lab
   compares six and nine before deciding.
8. **"Records start today"** may disappoint on the owner's current save.
   It's honest, and the owner's own save is the only one affected.
9. **Scope.** Six milestones before a single new event. C1 is small and
   fixes the real pain at once; C3 is invisible plumbing. If time
   presses, C5's Rare and Legendary ceremonies can follow later without
   blocking the events.

---

## K. First implementation recommendation

**Build first: C1, "Pull many".** It's the usability problem the owner
hit today, it's small (`handOff()` docks instead of putting away;
`bringUp()` keeps the page and the open cover; a quick arrival after the
first; a TO THE FELT key), and it improves the live game straight away.
Lab link, owner's try, then a release.

**Prototype first, alongside it: C2, "The Loupe".** The 3D card is the
biggest technical unknown (pixel sharpness under 3D transforms on iOS),
and every later milestone shows cards through it. A lab with the real
card, the four materials, SMOOTH vs STEPPED, and the readout layout
settles it on the owner's phone in one round.

### Decisions for the owner

1. The Loupe (card above, readout below, record marks on the back)?
2. Album sections by kind with a contents page, and six pockets per page
   (to be compared with nine in the lab)?
3. Sealed pockets for undiscovered events (silhouette and frosted to
   compare)?
4. "Records start today" for old saves (no invented history)?
5. Big moments only the first time; everyday actions faster?
6. Approve **C1** to build, and **C2** as the first lab?
