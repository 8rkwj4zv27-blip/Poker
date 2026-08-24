# Claude Code takeover brief

Use this as the operating brief for the next Claude Code session.

## Objective

Continue the controlled Poker Faces visual-system process from the current isolated Design Lab. The broad redesign has been stopped. Preserve the existing strange, tactile poker-machine identity and standardise only the construction and semantic grammar that the owner explicitly approves.

Your immediate task is **printed markings and labels in the isolated Design Lab only**. Do not migrate or modify a production screen.

## Start here

Read, in order:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/ui/VISUAL_SYSTEM.md`
4. `docs/ui/handover/CURRENT_STATE.md`
5. `docs/ui/handover/HISTORY_AND_REJECTIONS.md`
6. `docs/ui/handover/TECHNICAL_MAP.md`
7. `docs/ui/handover/NEXT_STEPS.md`

Then run `git status --short --branch`. Work on the existing branch `codex/ui-lab-visual-system`. At handover, its HEAD is `a5264a3`, identical to `main` and `origin/main`; all visual-system work is untracked and no project commit has been made. Do not stage the entire untracked set, commit or push.

Serve the repository locally and review `http://localhost:8765/design-lab.html`. The active Lab is `design-lab.html`, `css/design-lab.css` and `js/design-lab.js`, with production `css/01-foundation.css` used only for authentic fonts, variables and themes.

## Decisions you must preserve

- Main Menu is the locked menu/cabinet reference and must not be changed.
- Production FOLD/CALL/CHECK/RAISE remain the canonical large-action construction.
- Menu/launch control selection: B0 current-cartridge face with B0-C Soft Spring motion.
- CRT selection: C0 Current Upgrade housing with C0-G Static Burst behaviour.
- No moving glass-reflection animation.
- CRT text may flicker/stutter occasionally and must perform a finite blink/resynchronisation when content changes. Persistent blinking is only for warning, awaiting action or a genuinely live process.
- Frame shortlist: F0, F2, F3 and F5. There is no final frame winner.
- Keep the existing production mechanical reel/readout treatment. N0–N6 were all rejected and removed; do not recreate them.
- Physical parts carry printed text. Printed text does not glow, flicker, blink or animate.
- CRTs are recessed, near-black screens inside the textured physical board.
- Ordinary machine information is green/amber; live/current table information is pale blue; money/reward is warm gold; danger/defeat/destructive action is coral/red.
- Authored cards, suits, chips, faces, logos and sprites retain their colours.
- Player-dashboard geometry, content, assets and information placement are locked.
- TABLE CLEARED is a strong preservation reference. RUN OVER is its eventual negative sibling on the same chassis. Modify neither now.
- Hand Rankings is only a future first production pilot, after Lab and composite approval.
- `assets/ui/` is unrelated untracked material whose role has not been agreed. Do not touch or stage it.

## Implement now

Add a concise printed-label family to the active Design Lab. Show the hierarchy across a button legend, panel heading, tiny instrument label, money/stat label and warning/destructive label. Use one constant physical carrier and a small number of meaningfully different printing treatments, beginning with a faithful production-derived baseline.

Keep this family Lab-only. Add only the styling and minimal selection/reset/persistence behaviour it requires. Its appearance belongs in `css/design-lab.css`; its Lab interaction belongs in `js/design-lab.js`. Do not create a general component library.

The options must compare printed treatment, not new frames, CRTs or complex layouts. No descriptions deck, sliders, reference gallery, archive or decorative design essay is needed on the page. The owner wants a direct live list of options with relevant interactions and animations visible.

## Hard restrictions

- Do not modify `index.html` or load Lab files from it.
- Do not change gameplay, Career, poker logic, saves, lifetime statistics, results logic, service worker, manifest or build version.
- Do not modify Main Menu, player dashboard, TABLE CLEARED, RUN OVER, Hand Rankings or Settings.
- Do not add the Lab to production navigation or PWA caching.
- Do not touch unrelated untracked files.
- Do not revive rejected archived designs or build an archive UI.
- Do not commit or push before owner review.

## Verify and hand off

Verify the active Design Lab at about 393×852, a narrower phone viewport and a wide viewport, across `emerald`, `midnight`, `burgundy` and `slate`. Check readability, overflow, interactions, selection persistence and reset. Confirm production files remain unchanged.

Show the owner the live printed-label family and report exactly which files changed. Stop for approval. The next authorised stage, only after that approval, is one isolated composite console using the selected label system, B0/B0-C, C0/C0-G, the production reels and traits from F0/F2/F3/F5.

