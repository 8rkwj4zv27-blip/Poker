# Technical map

## Git and isolation

At handover:

- Branch: `codex/ui-lab-visual-system`
- HEAD: `a5264a3`
- `main` and `origin/main` point to the same commit.
- No project commit was created.
- `git ls-files -m` returns no tracked modifications.
- The Design Lab and handover package are untracked.

This means a blanket `git add .` is unsafe. It would also stage unrelated `.DS_Store` files and the untouched `assets/ui/` directory.

## Active Design Lab files

| File | Purpose |
|---|---|
| `design-lab.html` | Unlinked internal comparison page. Loads production foundation themes plus isolated Lab CSS/JS. |
| `css/design-lab.css` | Utility-board layout and all experimental specimen construction/effects. Selectors are scoped to the Lab. |
| `js/design-lab.js` | Family registry, rendering, theme mode, shortlist/select/reset persistence and live demonstrations. |
| `docs/ui/VISUAL_SYSTEM.md` | Durable semantic grammar and current owner selections. |
| `docs/ui/references/production-main-menu.jpg` | 393×852 production reference. |
| `docs/ui/references/production-dashboard.jpg` | 393×852 production reference. |
| `docs/ui/references/production-table-cleared.jpg` | 393×852 production reference. |
| `docs/ui/handover/*` | Takeover package. |

The active Lab is not referenced by `index.html`, `sw.js`, `manifest.json` or `BUILD_VERSION`.

## Superseded isolated files

These files belong to the earlier broad UI Lab and are not the active approval surface:

- `ui-lab.html`
- `css/ui-lab.css`
- `js/ui-lab.js`
- `css/00-visual-tokens.css`
- `css/01-machine-components.css`

They contain useful historical component experiments, including the positively received result-stage candidate, but they are not current production code and are not loaded by the active Design Lab or game.

Do not treat them as approved components. Do not delete or stage them without owner review; the result-stage work may still be useful as visual reference.

## Active Lab architecture

`design-lab.html` loads:

1. `css/01-foundation.css` — real production themes and base fonts.
2. `css/design-lab.css` — isolated Lab board and specimens.
3. `js/design-lab.js` — Lab-only interaction.

The page defaults to the CRT effects family.

### Families currently rendered

| Family | Registry IDs | CSS class pattern | Storage key |
|---|---|---|---|
| C0 CRT Effects | C0-A–C0-G | `.crt-effect-c0-*` | `pokerFaces.designLab.crtEffects.v1` |
| B0 Press Motion | B0-A–B0-G | `.button-motion-b0-*` | `pokerFaces.designLab.buttonMotion.v1` |
| Frames & Panels | F0–F6 | `.variant-f*` | `pokerFaces.designLab.frames.v1` |

The Lab never reads production save, Career, settings or lifetime-statistic keys.

### Interaction hooks

- `[data-crt-demo]` triggers a finite channel change and swaps representative feed text.
- `[data-demo-control]` triggers the selected button-motion demonstration.
- `[data-shortlist]` toggles a family shortlist.
- `[data-approve]` selects one family option.
- Reset removes only the active family's isolated key.

### Theme behaviour

Production theme IDs are defined in `css/01-foundation.css`:

- `emerald`
- `midnight`
- `burgundy`
- `slate`

The production game applies a theme through `document.body.setAttribute('data-theme', settings.theme)` in `js/07-ui-wiring.js` and related initialisation in `js/04-modes-and-scoring.js`.

The Lab reuses the same `[data-theme]` variables and offers an `all` comparison mode without creating another theme registry.

Cabinet/material colours respond to the active theme. The approved semantic CRT colours stay stable across themes:

- pale blue `--crt-live`;
- amber `--crt-machine`;
- warm gold `--crt-money`;
- coral `--crt-danger`.

Deep wells and CRT glass remain near-neutral black.

## Current production references

### Main Menu

- Markup: `index.html`, `#home`, `.lobby-card.pc-housing`, `.pc-control-bay`, `.pc-primary-cradle`.
- Construction: primarily `css/04-overlays-and-modes.css` with current theme-alignment overrides in `css/03-action-console.css`.
- The launch control uses `#home .pc-button-primary`; secondary controls use `#home .pc-button-secondary`; compact utilities use `#home .home-row .btn-secondary`.
- Do not modify the menu or Continue behaviour.

### Player dashboard and CRTs

- Markup: `index.html` around `#hud-frame`, `#hand-strength`, `#banner`, `#jackpot`, `#hud-invested` and `#raise-amt`.
- Main construction: `css/03-action-console.css`, especially the dashboard housing and `.crt-screen` rules.
- Responsive amendments: `css/05-responsive-and-arcade.css`.
- Result/dormant dashboard transformations: `css/02-screens.css` and `js/06-presentation.js`.
- Dashboard geometry and artwork are locked.

### Production mechanical reels

- Main reel presentation code: `js/06-presentation.js`, including per-digit reel updates, fixed player stack reels, raise reels, staggered delays and counter-lock sound.
- Main reel styling: `css/02-screens.css`, plus responsive reel fitting in `css/05-responsive-and-arcade.css`.
- Representative markup: `#jackpot`, `.jp-cell`, `.reel-digit`, `.reel-cell`, `.reel-strip`, `.mini-jackpot`.
- This existing implementation is the canonical readout. Do not replace it with the superseded experimental `counter-machine` system from `css/01-machine-components.css`.

### TABLE CLEARED and stage movement

- Production styling: `css/02-screens.css`, especially the TABLE CLEARED result-stage section and result dashboards.
- Behaviour and transitions: `js/04-modes-and-scoring.js`, `js/05-game-engine.js` and `js/06-presentation.js`.
- Relevant existing commits in history include the table-clear wheel/cabinet polish, but no new result work exists on this branch.
- Production reference image: `docs/ui/references/production-table-cleared.jpg`.

## Running and verifying the Lab

From the repository root:

```sh
python3 -m http.server 8765
```

Open `http://localhost:8765/design-lab.html`.

Minimum checks after a Lab edit:

1. `node --check js/design-lab.js`
2. Check `git diff --check` for tracked edits and inspect untracked files explicitly.
3. Confirm no Lab reference appears in `index.html`, `sw.js` or `manifest.json`.
4. Check approximately 393×852.
5. Check a narrower mobile width around 355 CSS pixels.
6. Check a wider layout around 1180×900.
7. Cycle emerald, midnight, burgundy and slate.
8. Test shortlist, select, reload persistence and reset.
9. Confirm prior selections in the other families remain visible.
10. Reload production and verify no appearance/behaviour change.

## Verification already completed

- Every visible family rendered seven equal-size specimens.
- All four production themes were cycled.
- `all themes` mode rendered 28 specimens without horizontal overflow.
- 393×852, approximately 355×800 and 1180×900 were inspected.
- Labels and controls did not clip.
- B0-C and C0-G interactions completed and settled.
- CRT semantic roles stayed stable across themes.
- Frame shortlist survived independent family resets.
- Production remained free of tracked changes.

## Known Lab-only technical debt

`css/design-lab.css` still contains non-rendered structural experiments for the superseded B1–B6 button-design board and C1–C6 CRT-construction board. The active JavaScript no longer emits those class names.

Treat those blocks as residue, not approval. A future cleanup may remove them after the owner confirms the handover package, but cleanup is not the immediate product task.
