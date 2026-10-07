# Pixel atmosphere experiment

Status: isolated proposal, awaiting owner review. Based on verified v0.66.1,
commit e64b2158e334ce8bad5dca28c4307f5f09beea90. No live finish is replaced.

## Brief

A richer, quieter pixel poker machine, with unmistakable venue atmosphere.
Preserve spacious felt, dense console, authored cards/chips/faces, and real
Hold'em. Defer expanded character performance and major-hand choreography.

## Comparison

`pixel-atmosphere-lab.html` loads the real game in a phone-width frame, with
in-memory storage and no service worker. TUNE opens controls inside the game.
Current is the shipped Emerald finish. A / Refined retains green enamel;
B / Crafted explores burgundy velvet hardware, an inward padded rail and
discrete dithered lighting. Both offer Back Room / High Roller material and
light changes, with identical game terms. Room labels are mounted plaques,
not text printed onto the felt. No economic or Career catalogue change.

Compare finishes during the same hand. GUIDED makes opponents check/call and
automates the player's preflop calls to open on an actual flop. NORMAL AI uses
the shipped opponents; NEW HAND starts a fresh disposable game. Motion and
sound switches apply to the preview only. Existing flight and chip physics
remain, with candidate key recovery, raise-panel travel and card contact.

## Boundaries

The previous felt decisions remain the baseline: no decorative cloth print,
no noisy ornament, no chasing lights. Candidate component changes remain
lab-only until approved and recorded in the Pattern Book. No replacement
artwork, dependencies, framework, poker rules, economy or save migration.
No BUILD_VERSION / cache bump: none of the new files enter the live shell.

## Delivery and validation

Required delivery is a private Artifact, per CLAUDE.md. This session has no
Artifact publish tool. Build, inspect and bundle the prototype before reporting
that delivery limitation. A local Codex preview and screenshots provide an
immediate review surface; the bundle preserves the phone publication route.
Record actual checks and the preview/bundle paths after validation.

### Validation, 7 October 2026

- Baseline `npm test`: 25/25 suites passed. After implementation: 25/25
  suites passed. Final syntax, diff whitespace and Pattern Book checks passed.
- Browser comparisons at 390 × 844; initial compact layout at 320 × 700;
  also checked the 430 × 720 framed layout. Narrow/short views put the venue
  plaque below the pot; showdown hides it to keep inspection clear.
- Current / Refined / Crafted and both room switches preserve the same hand.
- Half-pot preset, cancellation and a pointer drag changed the real wager
  readout. A guided wager was accepted and the next street continued.
- A full guided hand reached showdown, paid Harry, and returned to NEXT HAND.
  Normal AI started a fresh hand and folded an opponent (rather than the
  guided call/check behaviour). Reduced/animated choices persisted on restart.
- Both srcdoc local preview and baked game.html route run. The browser logged
  a startup MutationObserver diagnostic in the framed preview; an early page
  error listener did not capture a corresponding game error. Its origin is
  unresolved; do not describe this as a console-clean device test.
- Physical iPhone, actual touch input, sound audition and sustained frame-rate
  testing remain for owner review. Browser pointer interaction is not a touch test.

Local review: `http://127.0.0.1:18765/preview.html`. The bundle includes a
standalone wrapper and all 164 staged game files. The session's evidence
folder contains `experiment/comparison.jpg`, four full-size scene captures,
and the compact capture. No private Artifact URL is available in this session.
