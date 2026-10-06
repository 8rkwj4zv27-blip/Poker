# POKER FACES

Poker Faces is a mobile-first, single-player Texas Hold'em game primarily designed to be played as an installed PWA on iPhone.

## Core design principle

The player should feel like they are operating a strange, tactile little poker machine rather than navigating a conventional mobile UI.

The poker table itself should remain spacious and theatrical.

The player's lower console is deliberately dense and cluttered: cards, chips, meters, readouts, betting controls and three large action buttons.

Do not simplify this into a conventional clean mobile-app UI. Complexity and visual clutter are intentional, but controls should remain understandable.

## Art direction

- Pixel art
- Dark burgundy / velvet
- Green felt
- Warm gold / mustard instrumentation
- Cream playing cards
- Chunky shadows and borders
- Physical-looking buttons and controls
- Retro electronic / casino-machine character

The overall feeling is a strange velvet-covered poker machine.

## Game principles

- Real Texas Hold'em remains the core game.
- Poker rules and hand evaluation must remain correct.
- AI opponents should feel like characters rather than generic bots.
- Personality, mood, facial expression and occasional table talk are important.
- Table talk should remain sparse rather than occurring constantly.
- Avoid unnecessary RPG systems, currencies, power-ups or generic mobile-game mechanics.
- Assistance features can teach poker, but should feel like instrumentation built into the machine.

## Technical principles

- iPhone/PWA is the primary target.
- Preserve working poker logic unless explicitly asked to change it.
- Avoid unrelated refactors.
- Do not migrate to a framework without explicit approval.
- Do not introduce dependencies without approval.
- Work in small, testable changes. Run `npm test` before and after every change (GitHub runs it on every pull request), and `npm run play-test` before merging changes to files players download.
- Plan substantial changes before implementing them.
- Do not change visual design merely to make code or UI more conventional.
- Preserve existing localStorage settings and lifetime statistics unless a task specifically requires changes to them.

## Visual consistency (Pattern Book)

Repeated UI parts (CRT screens, buttons, keys, choice rows, headers, number
wheels) follow `docs/ui/PATTERN_BOOK.md`: same job, same finish. Use the
book's shared class for a part rather than styling its finish locally. A
genuinely new part is signed off and added to the book (and
`validation/pattern-book-checks.js`) before it's used in the game.

## Visual labs: how the owner receives them

Every visual lab (any `*-lab.html` order form, prototype or comparison
page) is delivered to the owner as a **private Artifact link** they open on
their phone, not as a branch to merge or a local server to run. Build and
check the lab as usual, then:

1. `node validation/tools/lab-bundle.js <lab>.html <scratchpad>/bundle-<lab>`
   stages the lab with a copy of the real game (`game.html`) and every file
   it loads.
2. Publish with the Artifact tool: `file_path` = the staged `<lab>.html`,
   `root` = the bundle folder, `files` = the paths in its `files.json`
   (give the `.PNG` faces `contentType: image/png`).
3. Give the owner the claude.ai link in the reply. After a change,
   re-stage and republish to the same link (same file path in the session,
   or `url` from a later one) rather than making a new one, and record the
   link in the lab's plan doc.

Still commit and push the lab to the branch as before; the link is how the
owner looks at it.

**Build every lab phone-first** (the owner looks at labs on their phone,
in the Claude app): the game full screen in one frame, no mock phone frame,
and the lab's controls running *inside* the game (a small TUNE key and a
bottom sheet, 44px+ tap targets). Declare what goes into the game copy in
the lab page as `<script type="application/json" id="lab-inject">`
(`{"css":[...],"js":[...]}`): the bundler then bakes `game.html` with it,
so the published link never builds a nested srcdoc copy (that failed in the
app on a phone). `showdown-lab.html` + `js/showdown-lab-host.js` +
`js/showdown-lab.js` are the pattern to copy. Check it in an emulated iPhone
with real touch (`validation/tools/touch-harness.js`) before sending.

## Codebase map

Before searching the codebase cold, read `docs/QUICKMAP.md` (one page:
which file owns what). Open `docs/CODEMAP.md` only for the section on the
file you're about to change; it's long, so never read it whole. Both are
maps, not specs: the code and this file remain authoritative.
`docs/README.md` says which docs are current and which are history.

## Housekeeping (keep it tidy)

- **One job per branch and pull request.** Merge only with `npm test`
  green. Never push straight to `main`.
- **Every change to files players download is a release:** bump
  `BUILD_VERSION` (`js/02-support-systems.js`) and `CACHE_NAME` (`sw.js`),
  bump the `?v=` tag of each changed file identically in `index.html` and
  `sw.js`, and add a line to `CHANGELOG.md`. `version-checks.js` and
  `offline-list-checks.js` fail if these drift.
- **Keep the maps true in the same pull request.** A new, moved or deleted
  live file updates `docs/QUICKMAP.md` and its `docs/CODEMAP.md` section.
  A new plan doc goes into `docs/README.md`, and a shipped plan gets the
  Historical banner. A Career milestone updates `docs/career/STATUS.md`.
- **Labs don't pile up.** When a lab's feature ships, keep the lab only if
  a test suite reads it. Otherwise move it and its files to the
  `checkpoint/labs-archive-2026-10` branch, and mark it archived in
  `CODEMAP.md`.
- **No leftovers.** No unused functions, variables, files or art, no
  commented-out code, and no `console.log` left in live files. Remove what
  your change makes unused. Original art lives in `art-source/`, never in
  `assets/`.
- **Nothing is deleted without a way back.** Unmerged work goes to a
  protected `checkpoint/` branch first. `docs/audit/PHASE0_BASELINE.md`
  lists every backup and how to restore it.
- **Cheap sessions:** read the quick map, then only the files and sections
  the job needs. Don't read whole large files (`06-presentation.js`,
  `05-game-engine.js`, `coin-world.js`) when a search finds the function.

## Career mode continuity

Before Career work, read `docs/career/STATUS.md` first — it's short, and
states the current build and the one concrete Immediate next task. Only
read `docs/career/CAREER_DESIGN.md` (product rules/economy) or
`docs/career/BUILD_PLAN.md` (phase sequence and scope) when the task
actually touches those — most presentation, polish, or bug-fix work needs
neither. `docs/career/HISTORY.md` is a dated archive of completed
milestones and superseded plans; open it only to research how something
specific was already built or decided, never as a default read — and don't
assume something it describes as shipped actually is without checking the
code (`STATUS.md`'s "Where we are" and `docs/CODEMAP.md` reflect what's
actually in the codebase; `HISTORY.md` entries occasionally describe work
that was written up as complete but never actually committed).

Treat `STATUS.md` as the source of truth over old chats, decks, prompts, or
speculative proposals. Do not treat provisional future-catalogue numbers as
implementation requirements. Work only on the Immediate next task in
`STATUS.md` unless the user explicitly changes scope.

After a Career milestone, update `STATUS.md` (moving older entries into
`HISTORY.md` if `STATUS.md` is getting long again). Update `BUILD_PLAN.md`
when scope or order changes, and update `CAREER_DESIGN.md` only when a
product decision changes.
