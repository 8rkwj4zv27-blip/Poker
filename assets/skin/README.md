# assets/skin — the owner's own art

See `docs/ui/SKIN_PLAN.md`.

- `templates/cards/` — **generated**, don't edit by hand. The game's own
  cards cut into drawing templates by `validation/tools/skin-cards-export.js`
  (rerun it after any change to how cards look). `cards.json` says where
  each part of the index sheet lands on a card.
- `cards/` (when it exists) — the owner's finished card art, with the same
  file names as the templates (`cards-L-back.png`, `cards-M-index.png`, …).
  Not loaded by the game until the card pilot ships.
