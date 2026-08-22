# THE TABLE

The Table is a mobile-first, single-player Texas Hold'em game primarily designed to be played as an installed PWA on iPhone.

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
- Work in small, testable changes.
- Plan substantial changes before implementing them.
- Do not change visual design merely to make code or UI more conventional.
- Preserve existing localStorage settings and lifetime statistics unless a task specifically requires changes to them.

## Career mode continuity

Before planning, reviewing, or implementing Career work, read these files in order:

1. `docs/career/CAREER_DESIGN.md`
2. `docs/career/BUILD_PLAN.md`
3. `docs/career/STATUS.md`

Treat them as the source of truth over old chats, decks, prompts, or speculative proposals. Do not treat provisional future-catalogue numbers as implementation requirements. Work only on the Immediate next task in `STATUS.md` unless the user explicitly changes scope.

After a Career milestone, update `STATUS.md`. Update `BUILD_PLAN.md` when scope or order changes, and update `CAREER_DESIGN.md` only when a product decision changes.
