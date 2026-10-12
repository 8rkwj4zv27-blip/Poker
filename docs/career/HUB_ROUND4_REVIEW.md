# Hub Round 4 — review and validation

8 October 2026. Lab only, based on production v0.67.0 at `18de0d4`.
Branch: `codex/hub-reader-polish`. The owner's existing working checkout
and production assets were not edited. No version/cache bump: neither lab
is loaded by `index.html` or the production service worker.

## What to try

Open `hub-lab-app.html` for the standalone phone layout, or `hub-lab.html`
for the normal private Artifact packaging. Default starts Home; choose
Career. `?hub=1` skips that tap. Every launch has an in-memory Career.

1. Watch three invitations deal onto the felt. Read their exposed entry
   stamps. Select Harry's invitation and inspect the printed paper brief.
2. Put it back, pick another, or flick the selected ticket up. FEED IT is
   the alternative with the same terms and entry transaction.
3. TUNE → $350, then select the $300 Pub ticket. The reader holds it for
   the bankroll warning; cancelling returns it without a debit.
4. TUNE → $50. Entry is unavailable for these tickets. TUNE → $1,840
   restores the normal fixture.
5. Compare PAPER BRIEF / FACE ONLY; REAL / HALF / QUARTER speed; FULL /
   REDUCED movement. REST / SELECTED / AT THE SLOT are still studies of
   the same rendering and cannot buy an entry. PLAY enables entry.
6. Returning from a paid table shows CONTINUE EVENT, with no second debit.
   Reload starts a new throwaway Career.

The Case and Vendor are labelled preview doors. Collection persistence,
pack purchase/reveal, rarity, duplicates and new event rules are not built.
Existing opponent faces are temporary illustrations for the owner's art.

## Checked

- Baseline full `npm test`: all 25 suites passed, including zero scoring
  audit divergences. After-change full suite: all 25 passed in 236s.
- Rendered REST, SELECTED and AT THE SLOT at 320×700, 375×667, 390×844 and
  430×932. The selected ticket clears its paper brief; every active key
  is at least 44×44px and both lower doors remain within the viewport.
- Real touch emulation (`hasTouch`, mobile viewport, DPR 2, Chromium CDP):
  paid FEED IT seats Harry and changes $1,840 → $1,740 exactly once.
- Slow off-slot drag, diagonal release and touch cancellation at the
  reader: no entry, $1,840 unchanged, selection restored. A short fast
  upward flick seats Harry with the same $100 debit. Gesture velocities
  use input timestamps, so delayed event handling does not change intent.
- Risky $300 entry from $350: held before debit, cancel leaves $350 and
  no active event; confirm leaves $50 and seats the advertised four-player
  Pub event. Repeated entry dispatches during feed do not debit again.
- Low $50 bankroll disables entry and forced entry dispatch cannot charge.
- Reduced Motion paid entry and CONTINUE after returning to the Hub:
  $1,740 remains $1,740; paid cards cannot be bought or shuffled again.
- A real Career hand played through Check/Call and Award Pot, reaching
  the next-hand key with no uncaught errors; bankroll stayed at $1,740.
- Local frame and staged/baked Artifact frame both render the same three
  cards and selected brief at 390×844, with $1,840 and no missing assets.
- Native Career/settings storage sentinel values remain unchanged after
  entry and resume. Frame packaging is checked separately from standalone.
- Keyboard Enter selects, arrows move selection, Escape returns the card.
  TUNE makes the background inert, traps Tab and returns focus on close.
  Risk warning starts on Cancel, supports Escape and traps Tab. Settings
  opens the existing sheet; Back returns to Home.
- No uncaught JavaScript errors in the exercised scenarios. Programmatic
  Home entry can emit the existing browser audio/haptic gesture warnings;
  normal player taps unlock them. No production audio code was changed.

The repository CLI play-test needs a Playwright package and Linux browser
path that this Mac session does not have. Equivalent Hub scenarios were
run with the available Playwright browser tool; no dependency was added.
This is browser emulation, not a physical iPhone or installed-PWA test.

## Delivery and next decision

The normal Artifact bundle is staged with `validation/tools/lab-bundle.js`.
This session has no Claude Artifact publisher. The recorded Round 3 Claude
link is therefore unchanged; do not present it as Round 4. A playable local
preview and checked screenshots are available in Codex.

Owner review comes next: the three-ticket fan, printed brief, reader height
and flick feel. My remaining visual concern is the artwork: larger cards
expose how provisional the portraits are. Judge the object proportions and
motion now, then create venue scenes / character illustrations before
claiming final art polish. The Vendor starts only after Hub feedback.
