# Poker Faces — Design & Planning Project Source

Current snapshot: 26 August 2026
Purpose: a compact handover for the ChatGPT project **Poker Faces — Design & Planning**. This is a readable summary, not a replacement for the canonical repository documents listed in section 10.

## 1. Current playable game and live version

Poker Faces, titled **The Table** in the installed app, is a mobile-first, single-player Texas Hold'em PWA built primarily for iPhone.

The current repository and remote `main` build is **v0.23.0-dev · Scoring Correction**, using service-worker cache **poker-v22-0** and Career save schema **v4**. The published game is at [8rkwj4zv27-blip.github.io/Poker](https://8rkwj4zv27-blip.github.io/Poker/). A fresh on-device check of this exact build is still outstanding.

The playable game includes:

- Single Player elimination runs with selectable table size.
- Classic Table Setup and Quick Deal.
- Career tournament events with bankroll, unlocks, saving and resume.
- Character opponents with faces, personality and sparse reactions.
- Hand Rankings, Score/Awards, Settings, themes and lifetime statistics.
- Installed-PWA support and local save continuity.

## 2. Approved product and visual direction

The game must feel like a strange, tactile little poker machine, not a conventional mobile app. The table stays spacious and theatrical; the player's lower console stays deliberately dense, physical and instrument-like.

The visual grammar is:

- **Physical parts:** textured cabinet, board, bezels, frames, buttons and switches with visible thickness, hard edges and tactile travel. Their labels are printed and do not glow or animate.
- **CRT output:** recessed near-black glass for changing information, with scanlines, vignette, restrained bloom, occasional signal stutter and a short channel-change blink when content changes. No moving glass reflection.
- **Mechanical numbers:** the existing vertical reel system for important counted or settled totals. Do not replace it with a new counter design.
- **Playing cards and chips:** authored tactile objects, visually distinct from screens and never recoloured by the UI theme.

Semantic colour roles remain stable across themes: pale blue is live/current table information; green or amber is ordinary machine information; warm gold is money, reward and restrained positive information; coral/red is danger, defeat and destructive action.

The active machine themes are emerald, midnight, burgundy and slate. Themes alter machine materials and controls, not cards, chips, faces, logos or other authored artwork.

Career is a **soft poker RPG around the poker, never inside it**. Real poker remains the source of success. Progress should come from bankroll, access, opponent familiarity and trophies—not perks, powers or extra currencies.

## 3. Major systems already implemented

- Correct Texas Hold'em play, hand evaluation, side pots, payouts and elimination flow.
- Character-led AI opponents and a theatrical table presentation.
- Single Player run scoring, awards, high scores and lifetime statistics.
- Career bankroll, paid entry, placement payouts, unlocks, active-event persistence and resume.
- A scrolling Career event directory with a themed player instrument, fixed house directory, inspectable locked events, opponent faces, threat/terms display and one expandable event tray at a time.
- A free **Second Chance** recovery event that appears only below a $100 bankroll.
- One shared rolling major-result stage for TABLE CLEARED, RUN OVER, EVENT WON and EVENT LOST. EVENT CASHED deliberately remains a restrained plain result card.
- The production machine visual system: P0 printed ink, recessed CRTs, finite static-burst refresh, existing mechanical reels and restrained menu-button spring motion.
- Developer-only testers for bankroll boundaries, scoring cases and major-result transitions.

## 4. Career mode: current state and approved roadmap

Career starts with **$500**. The current playable catalogue is:

- **Back Room Freezeout:** $100 entry, three players, 500 starting stack, $300 to first.
- **Pub Circuit Freezeout:** $300 entry, four players, 750 starting stack, $1,200 to first.
- **Pub Circuit Open:** $300 entry, five players, 750 starting stack, $1,050 to first and $450 to second.
- **Second Chance:** free, three players, 500 starting stack, $150 to first; visible only while bankroll is below $100 and grants no venue unlock.

The directory already shows the six-room ladder from Back Room through Invitational Championship, but only implemented events are playable. Higher rooms remain clearly locked or coming soon. The player instrument shows name, mechanical bankroll, highest access, events played and events won.

Approved sequence after the current verification gate:

1. Phase 5: add contextual Recommended/Alternative/Next/Special logic and make the Full Circuit legible inside the existing directory.
2. Phase 6: measure Back Room pacing before changing blinds, stacks or AI timing.
3. Phase 7: named residents, authoritative rosters and a minimal shared familiarity record.
4. Phase 8: a named Back Room boss seat and one-time first-clear ceremony.
5. Phase 9: one Back Room-only cash table.
6. Phase 10: extend the directory for live cash, boss and field state.
7. Phase 11: playtest the complete Back Room slice.
8. Later: Pub expansion, dossiers/records/titles, trophies, cosmetic spending, then Card Club and higher venues one at a time.

The approved cash-table prototype is four-handed, Back Room only, $50 buy-in, $1/$2 blinds, 50-chip stacks, whole-dollar currency, no rake and full-stack cash-out only between completed hands. It is not implemented.

## 5. Scoring system: current state

The score counter is **not XP**. Its canonical meaning is:

> An ephemeral machine tally generated by positive chip results and objective milestones. It is not profit, skill, XP or Career progression.

Career Event Score is the same tally reset for each event. It is display-only, persists nowhere and unlocks nothing.

The August 2026 correction is code-complete. Scoring now uses the player's **net result on the hand**, not the whole table pot. The objective award catalogue is POT WINNINGS, BIG WIN, MASSIVE WIN, DOUBLE UP, MONSTER HAND, K.O., TABLE CLEARED and EVENT WON. Decision awards such as GOOD CALL, GOOD FOLD, HERO CALL and GOOD PRESSURE have been removed from both points and presentation.

Post-hand commentary is separate from scoring. It uses the table's CRT line, states only public and truthful facts, never reads unseen cards, never pretends to be a solver and never grades the player. Decision-quality advice is deferred until a future action-conditioned range model exists.

Terminal hands now bank legitimate score silently before the appropriate result stage. A bust should go directly to RUN OVER or EVENT LOST without a contradictory celebration. Lifetime statistics use net-positive hands and biggest net win going forward; historical stored values are preserved because past hands cannot be reconstructed.

The correction still needs rendered manual verification before it is considered fully signed off.

## 6. Important owner decisions

- Bankroll is Career's only spendable and volatile currency.
- No XP, levels, perks, power-ups, poker advantages or additional currencies.
- Bankroll may buy event entry, future Back Room cash play and approved cosmetics; it may not buy status, knowledge, trophies or poker power.
- Second Chance uses a fixed below-$100 rule; it is not derived from another balance value.
- One resident identity follows a character across cash and tournaments; mode-specific statistics may be shown separately.
- The Back Room boss is a named seat in an existing event, not a separate boss event.
- Career pacing must be measured in hands-to-conclusion and flop-seen rate before blinds or stack behaviour are changed.
- Score remains a visible machine tally, but it is never described as XP, skill or progression.
- Decision-quality commentary is not built until the game has a credible action-conditioned opponent model.
- TABLE CLEARED, RUN OVER, EVENT WON and EVENT LOST are four outcomes from one physical stage machine.
- The production player-dashboard geometry, central physical hole cards, chip bay and three large action buttons remain locked. Broad redesign is not authorised.
- Work proceeds one approved phase at a time; later roadmap phases are not parallel work.

## 7. Rejected or superseded directions that must not return

- Clean, generic mobile-app styling or flattened machine depth.
- Broad player-dashboard redesign, moved/obscured hole cards or replacement cards and chips.
- Beige, serif, typewriter or museum-interface styling.
- Hardcoded single-palette screens or palette washes over authored artwork.
- Moving glass-reflection animation, universal blinking or excessive button travel through the cabinet.
- New mechanical-counter concepts replacing the production reels.
- Compressed generic result cards replacing the shared rolling result stage.
- XP, experience levels, perks, power-ups, secondary currencies or RPG effects inside poker hands.
- Rake, fractional currency, partial cash-out, cash tables above the Back Room or a separate money-owning cash save.
- A separate boss event, a shop-like Career board or blind acceleration before pacing has been measured.
- Gross-pot BIG POT/MASSIVE POT scoring, decision awards based on weak equity estimates, or feedback influenced by hidden cards.
- Premature framework migration, new dependencies or a general UI JavaScript component library.
- Old UI Lab candidates, archived screenshots, speculative prompts and the Career expansion draft/review as current product truth.

## 8. Known issues and unresolved questions

- The corrected scoring presentation has not yet been watched through the required real hand/result scenarios.
- On-device iPhone checks remain outstanding for the latest build, the Career directory, Second Chance and all four rolling result transitions.
- Career pacing has not been measured. The cheapest event feels long, but no stack/blind/AI change is approved until instrumentation exists.
- Phase 5's contextual board logic and visible Full Circuit are approved but not implemented.
- Named residents, boss behaviour, the cash table, relationship records, trophies and cosmetics remain roadmap work.
- Cash depth, resident bankroll sizing and several later economy values remain working hypotheses until the Phase 11 playtest gate.
- A future action-conditioned range model and decision analysis may support useful poker advice, but this is unscheduled and must not be faked with the current evaluator.
- Old visual Lab fixture copy is one revision behind production scoring labels, and some deleted-commentary CSS is now unused. Neither is a production blocker.
- Main Menu Continue remains shelved. The intended role of untracked `assets/ui/` remains undecided and those files must stay untouched.

## 9. Single immediate next task

**Manually render and verify the Phase 4 scoring correction using Career STATUS checklist items 15–24.** Confirm truthful win/loss/chop/uncalled-bet commentary, no celebration before defeat, correct terminal score banking, Career EVENT WON naming, removal of all decision awards, corrected labels and no hidden-card leakage.

Do not begin Phase 5 until this visual and behavioural gate passes.

## 10. Authoritative repository documents

Use these as the source of truth, in this order where scopes overlap:

1. `AGENTS.md` and `CLAUDE.md` — global product, art and technical principles.
2. `docs/career/CAREER_DESIGN.md` — approved Career product design.
3. `docs/career/BUILD_PLAN.md` — Career phase order, scope, exclusions and dependencies.
4. `docs/career/STATUS.md` — current implementation state, outstanding verification and the one immediate next task.
5. `docs/scoring/SCORING_SPEC.md` — authoritative scoring and post-hand feedback behaviour.
6. `docs/ui/VISUAL_SYSTEM.md` and `docs/ui/handover/CURRENT_STATE.md` — current machine grammar and shipped visual decisions. Where an old subsection conflicts, use the current decision tables and `VISUAL_SYSTEM.md`; P0 Production ink is current and P4 Etched fill is superseded.
7. `docs/ui/handover/HISTORY_AND_REJECTIONS.md` — rejection history only, used to prevent old directions returning.

Do not treat old chats, prompts, screenshots, browser storage, untracked Labs, `docs/career/CAREER_EXPANSION_DRAFT.md` or `docs/career/CAREER_EXPANSION_REVIEW.md` as canonical. This handover should be refreshed after a shipped milestone; until then, the repository documents above always win.
