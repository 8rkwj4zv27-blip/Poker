# Poker Faces visual-upgrade handover

Date: 23 August 2026  
Status: isolated Design Lab work only; no production migration approved

This package is the durable handover for the Poker Faces / The Table visual-system project. It replaces chat history as the practical starting point for the next coding agent.

## Read in this order

1. Repository `AGENTS.md`
2. Repository `CLAUDE.md`
3. `docs/ui/VISUAL_SYSTEM.md`
4. `docs/ui/handover/CURRENT_STATE.md`
5. `docs/ui/handover/HISTORY_AND_REJECTIONS.md`
6. `docs/ui/handover/TECHNICAL_MAP.md`
7. `docs/ui/handover/NEXT_STEPS.md`
8. `docs/ui/handover/CLAUDE_CODE_BRIEF.md`

If any older prompt, Lab file or screenshot conflicts with this package, use this precedence:

1. The owner's latest explicit statement.
2. `CURRENT_STATE.md` and `VISUAL_SYSTEM.md`.
3. `NEXT_STEPS.md`.
4. Historical briefs and superseded UI Lab files.

## Project outcome so far

The broad redesign was stopped. The surviving direction is preservation-first: extract and standardise the existing physical poker-machine language without changing authored screen layouts or replacing production artwork.

The controlled Design Lab established the following:

- Frame traits shortlisted: F0, F2, F3 and F5. There is no final frame winner.
- Menu/launch button: B0 current-cartridge face with B0-C Soft Spring motion.
- CRT: C0 Current Upgrade housing with C0-G Static Burst behaviour.
- Mechanical numbers: keep the existing production implementation. All new readout candidates were rejected and removed.
- The next family should be printed markings and labels.
- After labels, build one isolated composite console specimen. Let that composite resolve the frame direction instead of running another abstract frame contest.

The production game has not adopted any of these experiments.

## Non-negotiable boundaries

- Do not modify a production screen without a new explicit owner instruction.
- Do not begin the Hand Rankings migration yet.
- Do not modify the Main Menu.
- Do not address the shelved Main Menu Continue issue.
- Do not modify the player-dashboard geometry, markup, information placement, cards, chips or sprites.
- Do not modify TABLE CLEARED or RUN OVER yet.
- Do not change gameplay, poker rules, Career logic, saves, statistics, results logic, service worker, manifest or `BUILD_VERSION`.
- Do not recolour authored content artwork with the UI theme.
- Do not add a Design Lab link to production navigation or cache the Lab in the PWA shell.
- Do not create a general JavaScript component library before a real production migration proves one is needed.
- Do not touch `assets/ui/` or unrelated `.DS_Store` files.
- Do not commit or push until the owner reviews the handover and next Lab pass.

## Repository state at handover

- Branch: `codex/ui-lab-visual-system`
- HEAD: `a5264a3`, identical to `main` and `origin/main` at handover time.
- Commits made for this project: none.
- Tracked production-file modifications: none.
- Design Lab, old UI Lab and handover files are untracked.
- Existing unrelated untracked assets and `.DS_Store` files remain untouched.

Run `git status --short` before doing anything. Do not stage the entire untracked set blindly.

## Active review surface

From the repository root:

```sh
python3 -m http.server 8765
```

Open:

```text
http://localhost:8765/design-lab.html
```

The page is intentionally unlinked from the game. It loads only the production foundation/theme CSS plus isolated Design Lab CSS and JavaScript.

## Handover definition of done

The transition is complete when the next agent can:

- reproduce the selected states without relying on this chat;
- explain what is approved, shortlisted, rejected and untouched;
- run and verify the Design Lab;
- identify active versus superseded files;
- carry out the printed-label pass without changing production;
- stop for owner approval before building the composite console.
