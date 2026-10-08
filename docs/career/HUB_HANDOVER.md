# Career hub pass: handover

Written 8 October 2026 for the next agent picking up the Career hub.
Read `CLAUDE.md`, `docs/HANDOVER.md` and `docs/career/PACKS_PLAN.md`
(Rounds 1 to 3) first. Nothing below is in the shipped game: it all lives
in lab pages.

## Where we are

The owner has chosen a new direction for Career: **packs of event
tickets**. You buy packs from a vending machine (or earn them), rip them
open, keep the tickets in a collection (the Case), and feed a ticket into
the machine to play that event. Three labs have been built so far:

| Lab | What it tried | Owner's verdict |
|---|---|---|
| `pack-lab.html` (Round 1) | Vending machine, finger-driven rip, card reveal, ticket case, feed into a real table | Right direction. Too cramped, buttons off-style, packs too small, reveal stage needs flair, used the old chip PNGs (the game now draws coins in `js/coin-world.js`) |
| `card-lab.html` (Round 2, branch `claude/card-lab`, **not merged**) | Code-drawn illustrated pixel cards in 3 frames, a hand you pick up | Rejected. Cards unreadable, art "very AI" and too abstract. **Keep:** pick-up physics, foil, shimmer |
| `hub-lab.html` (Round 3, on `main`) | Career opens on "tonight's tickets": dealt from a deck, styled by kind, carried on springs, fed into a slot, then on to a real table | "A really good step", the right direction. This is the base for the next pass |

The owner's phone links:
- Hub Lab: https://8rkwj4zv27-blip.github.io/Poker/hub-lab-app.html (and https://claude.ai/artifact/2yG9jqdsRWqgXqCRitTqbM)
- Pack Lab: https://8rkwj4zv27-blip.github.io/Poker/pack-lab-app.html

## How the Hub Lab works (files)

- `hub-lab.html` + `js/hub-lab-host.js`: the lab page. It loads the real game in a frame with the lab injected (`#lab-inject`) and in-memory storage.
- `hub-lab-app.html` + `hub-lab.webmanifest`: the home-screen version. It fetches `index.html` and rebuilds it with the lab's parts, with no frame and no service worker. This is how the owner tests on the phone (Safari, Share, Add to Home Screen). It only works once merged to `main`, because GitHub Pages serves `main`.
- `js/hub-lab.js`: the whole hub. `#hb` is appended inside `#career`, and the live Hub is hidden by CSS (`#career.hb-on > :not(#hb)`), not changed. The parts:
  - Ticket data: `POOL`, `drawSix()`, `ticketData()`. The tickets are real catalogue events (`careerEventById`, `careerRosterFor`), with lab-only titles for wild, jinx, character and format variants.
  - Styling by kind: `STYLE`. Events are tickets, formats are slips, characters and wilds are playing cards, jinxes are dark slips, big money is a gold ticket.
  - Motion: one spring layer (`#hb-layer`) holds every ticket, so a ticket can be carried anywhere. The fan's thumb-slide is `scrub`.
  - Feeding: `feed()` uses the real `enterCareerEvent()`, then `careerDepartToTable(startCareerEvent)`.
  - TUNE sheet: deal layout and speed.
- `css/hub-lab.css`: the hub. Ticket paper colours per venue are copied from `css/career-hub-v2.css`. The cartridge, CRT, cream keys and dark tiles follow `docs/ui/PATTERN_BOOK.md`.

## What the owner asked for next (8 Oct, after playing the Hub Lab)

1. **Three cards is the favourite.** The owner wants a spread of cards to work but "doesn't feel it" with five.
2. **More information when a card is selected; fewer stats on the card face.** The face is too busy and the owner wants the room.
3. **The bottom console is too heavy.** The owner is open to removing BUY IN if feeding the ticket does the buy-in, as long as that's made obvious.
4. **Move the ticket slot to the top of the screen.**
5. Polish everything further.

## Recommendations still to agree with the owner

These are proposals, not decisions. Confirm them with the owner, ideally with **still mockups first** (they responded well to that), before building:

- **Deal three in a gentle spread**, each card about 30–40% bigger than now and about two-thirds visible. Drop the hand of five; overlapping five on a phone is cramped whatever the interaction.
- **A clean card face:** venue, title, the art window (bigger, kept for the owner's own art; until then the table's faces) and **one number, the buy-in, as a corner stamp**. Prize, seats, places paid, the field and "why dealt" move to a **close-up** when you select a card: the card rises, its details show, and a small FEED IT key appears.
- **The machine head at the top:** bankroll reel and ticket slot in one housing, with a one-line CRT. The record (played, won, circuit) shrinks to a strip or moves to the Case. **Feeding is the buy-in:** flick a card up into the slot (no need to carry it all the way on a big phone), or tap FEED IT. No separate BUY IN cartridge.
- **Keep the bankroll safeguards.** Today's Career warns before risky buy-ins (`CAREER_DESIGN.md`, "Bankroll guidance" and "Entry protection"). A flick must not skip that: the slot should hold the ticket and ask.
- **Make the deal matter.** A free, unlimited RE-DEAL turns the deal into a slow menu. Options to put to the owner: the deal refreshes after each event played, one re-deal per visit, or a re-deal costs a little.
- **Make the Case the full choice.** Tonight's three are suggestions; the Case holds everything you own and lets you play any ticket. The hub should say so, so players don't feel stuck with three.
- **Bottom:** two slim doors, THE CASE and THE VENDOR, and nothing else.

Open questions put to the owner, not yet answered:
1. Buy-in on the card face, or an even cleaner face?
2. Re-deal: free, once per visit, or does it cost?
3. A FEED IT key in the close-up as well as the flick?

## After the hub

Build the Vendor (vending machine) and the Case (collection) screens to the same standard, reusing the Pack Lab's working parts: vend and drop, the finger rip, rarity reveals, chip spill. Redo their looks per the Round 1 feedback.

## Rules that matter here (from `CLAUDE.md` and the owner)

- **Labs are phone-first.** The game is full screen with a TUNE key and sheet. Check on emulated iPhones with real touch (`validation/tools/touch-harness.js`; start `python3 -m http.server 8765` in the repo root first).
- **Deliver every lab two ways:**
  - A private Artifact link (`node validation/tools/lab-bundle.js <lab>.html <outDir>`, then publish).
  - On request, a home-screen version (`<lab>-app.html` + manifest, copied from `hub-lab-app.html`) merged to `main` by pull request.
  - Lab-only merges change no game file and need no version bump. Run `npm test` (25 suites, about 6 minutes) before merging.
- **One job per branch, never push to `main`.** Update `docs/HANDOVER.md`, `docs/CODEMAP.md` (lab entry) and the plan doc in the same pull request.
- **Pattern Book:** use shared parts (cartridge `.pc-button-primary` in `.pc-primary-cradle`, `.crt`, cream small keys, dark tiles). A genuinely new part (ticket frames, the machine head) is signed off from the lab, then added to the book before it goes in the game.
- **Art:** the owner will draw the ticket art. Leave a clean art window; don't fill it with invented illustrations.
- **The owner likes to be pushed back on.** Discuss options with your view and the downsides; don't just agree.
- **Nothing in Career's real code, saves or poker logic** changes until the owner signs off a lab. The live Career (`career-hub-live.js` and friends) is untouched.

## Housekeeping owed

- `pack-lab*`, `hub-lab*` and their app pages and manifests are on `main` as temporary labs. Archive them to `checkpoint/labs-archive-2026-10` and remove them from `main` when the owner has decided (the owner agreed to this).
- `claude/card-lab` is an unmerged branch (rejected lab). Keep it as the record; don't delete it.
