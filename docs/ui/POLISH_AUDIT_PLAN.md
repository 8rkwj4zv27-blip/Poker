# Poker Faces — the Polish Audit, and the road to "chart-ready"

> **Status (6 Nov 2026):** approved by the owner. Phase 1 (complete the evidence) in progress.
> Owner's answers: they mark the gallery blind first; Classic Career is left out; Custom Game is audited but
> weighted lower; sound is in scope. The gallery: https://claude.ai/artifact/YE8yzWEAMVrSzSBZRwy2Bs

## Context

The owner now has the moments library (139 screenshots of v0.71.3, with a verdict and a note box per moment:
https://claude.ai/artifact/YE8yzWEAMVrSzSBZRwy2Bs). The game "feels good" but lacks the polish and charm of a
critically acclaimed indie game. The ask: a properly audited, critical look at every screen and moment, ranked
best to worst across visual design, UI, UX, character, style, polish and flourish; then a plan to fix the worst,
lift the best, and polish the whole game until it would look at home on an App Store or Steam best-seller chart.

The last whole-game audit (`docs/ui/VISUAL_AUDIT.md`, 25 Sep, v0.40) is Historical: its fix pass shipped and v0.42 to
v0.71 rebuilt most of what it graded. This audit replaces it. Constraints from `CLAUDE.md` still hold: the dense
console and the velvet machine are the identity (don't make it a clean mobile app), the poker logic stays correct, labs
come first, the Pattern Book governs repeated parts, and nothing ships without the owner's sign-off.

## What I already see (first pass from the captures, provisional)

Not the audit, just what the scored pass will test. **Strongest:** the main menu cabinet and its boot, the table
intro card, the gold YOU WIN console, the K.O. splash, the invitation cards and packet art, the album, the
vending machine, the P.I.P. report, the RUN OVER and EVENT WON stages. **Weakest:** Settings and the Workshop
pages (long forms), Custom Game (a form), Hand Rankings (a static list), the tour (plain dark cards over a dimmed
table), the table mid-hand (a big flat, dark felt with dead space in the middle and small cards), all-black
transition frames (classic buy-in, hub → event table), result stages full of zeros and "NO SHOWDOWN HAND
RECORDED", and dimmed or dead console keys on the result screens. **Across the game:** pixel type often too small to
read on a phone; the felt has no light or texture; table talk has been switched off in code since September;
sound is off by default, synthesised blips only, with no music.

## Phase 1: Complete the evidence (about 1 session)

Stills alone can't judge feel, so the audit gets the parts the library is missing:

1. **Motion clips.** Add a `--video` mode to `validation/tools/moments.js`: Playwright's `recordVideo` (ffmpeg is in
   `/opt/pw-browsers`), trimmed to about 15 key sequences: boot, menu → table, the deal, a showdown and AWARD, all-in
   runout, K.O., table cleared, run over, menu → Career, packet opening, card turn, PLAY → table, event won, the shop
   purchase, the P.I.P. report. Published as `<video>` files in the same gallery.
2. **Missing moments.** Fill these gaps: a veteran menu (stats filled) next to the first-launch one; confirm
   dialogs; the hand log; a Custom Game bust; the pity packet; a full album page; the table at 2, 3, 5 and 6
   opponents; at least one moment per Workshop skin.
3. **Other phones.** Take the core 30 moments at 375×667 (SE) and 430×932 (Pro Max), and again with Reduced Motion.
4. **Sound inventory.** List from the code every `Sound.*` cue (about 40, all synthesised in `js/02-support-systems.js`)
   with the moment it plays on, so audio is graded as well.
5. **The owner's blind pass (agreed).** The owner marks every moment Good / Tweak / Rethink, with notes, on the iPhone,
   before seeing my scores. I read the notes back from the gallery's `db` (`notes`), and the audit shows both
   verdicts, flagging every moment where we disagree. Feel, haptics and Safari rendering only show up on a real device.
   My own scoring is done independently and only published after the owner's pass is in.

## Phase 2: The rubric and scoring

Every moment is scored 1 to 5 on eight criteria, with a one-line reason per score:

| # | Criterion | The question |
|---|---|---|
| 1 | Readability | Can a player read it at arm's length on a phone: type size, contrast, hierarchy? |
| 2 | Usability | Is it obvious what to press and what just happened (affordance, feedback, 44px targets)? |
| 3 | Machine identity | Is this the velvet poker machine, or a generic app screen? |
| 4 | Character and charm | Faces, personality, humour, surprise: does it make you smile? |
| 5 | Craft | Alignment, spacing, pixel grid, Pattern Book use, no glitches, empty states or dead frames |
| 6 | Motion and feel | Transitions, juice, timing, sound and haptic support (scored from clips) |
| 7 | Weight of the moment | Does the drama match the stakes (a fold vs. a $3,000 all-in vs. winning an event)? |
| 8 | Cohesion | Does it look like it shares a world with its neighbours? |

- **Score** = the mean of the eight. The **ranking** sorts moments by score, best to worst.
- **Priority** = (5 − score) × how often it is seen (every hand / every session / rarely) × importance (Career and
  the table weigh most; Custom Game is audited in full but weighted lower). **Classic Career is left out** of the
  audit (owner, 6 Nov: didn't realise it was still in the game). Its 11 moments come out of the gallery, and
  retiring it from Settings → Career is noted as an open question for the handover, not part of this work.
- Moments are grouped into about **35 screens/moments** (e.g. the five "cleared" frames are one moment), so the
  ranking stays readable. All 139 images stay as evidence.
- **The benchmark shelf.** Each criterion is scored against named references, so a "5" means something:
  Balatro (poker juice, CRT, number roll-ups, card wobble), Inscryption (diegetic table UI, physical objects),
  Papers, Please (a desk you operate), Luck be a Landlord / Slay the Spire (rewards and run-end screens), Loop Hero
  and Cult of the Lamb (warmth and character in small UI). Each reference is noted for what to take from it, never to copy.

## Phase 3: The deliverables

1. **The audit page** (Artifact, to the owner's phone): the ranked list from best to worst. Each moment shows its
   screenshot and clip, its eight scores, what works (keep / lift) and what fails (fix), with the owner's own
   verdict beside mine where they differ. It opens on a one-screen summary: the overall grade, the top 5, the bottom 5,
   and the cross-cutting themes.
2. **Cross-cutting findings**, the issues that span many screens: the type scale; colour and lighting (the felt has no
   light falloff, vignette or texture); empty and zero states; dead and black frames; how keys power down; spacing
   rhythm; copy and voice; audio; idle life (nothing moves while you wait); and the first 60 seconds.
3. **The durable copy**: `docs/ui/POLISH_AUDIT.md` (the scorecard and findings), added to `docs/README.md`. It
   supersedes `VISUAL_AUDIT.md`, which is already Historical. HANDOVER's Next gets updated.

## Phase 4: The road to "another level" (proposed tracks, each lab-first and signed off)

Order is set by the audit's priority scores; this is the expected shape:

| Track | What it is | Why it matters |
|---|---|---|
| **A. Fix pass** | Dead/black frames, empty "0 / —" states, dimmed result keys, text too small to read, any overlaps found | Cheap; it removes the "unfinished" signals that undercut everything else |
| **B. Visual system** | A real type scale for the pixel faces (minimum sizes); felt lighting (a pool of lamp light, vignette, cloth grain); a lighting and shadow recipe for the cabinet; a velvet/gold accent pass; Pattern Book updates | The single biggest jump in perceived quality, applied everywhere at once |
| **C. Juice on the big moments** | All-in reveal and the river sweat; showdown and AWARD (hit-stop, roll-ups, screen nudge, chip bursts); K.O.; big-pot and monster-hand tiers; event won as a ceremony | These are the moments in trailers and screenshots, the "Balatro factor" |
| **D. Character** | Faces react to the board and the pot; table talk back through the machine (rare, allow-listed, the owner sets how rare); P.I.P.'s personality in more places; idle life on the menu and hub | The brief's own pillar, and currently the most muted one |
| **E. Sub-screens as cabinet parts** | Settings as a service panel, Custom Game as a ticket you print, Hand Rankings that teach (tap to light the cards), the tour as machine plates, the hand log as a receipt | Removes the remaining "mobile app form" screens |
| **F. Sound (in scope, owner 6 Nov)** | Graded in the audit (cue by cue, from the inventory). Then a sound pass: a recorded or richer cue set for the machine (relays, chips, cards, CRT hum), an ambient room tone, sound on by default with a clear mute, and haptics matched to the cues | Polished indie games are half sound; ours is off by default. Each audio file comes to the owner for approval before it ships (no dependencies) |
| **G. Store-readiness** | Icon, launch screen, first-60-seconds flow, a screenshot set and a 30-second capture of the best moments, built from the moments tool | What a chart-topper's store page shows; it also serves as a final check of A to F |

Each track follows the house workflow: a lab (phone-first, published as a link), the owner's sign-off, then a
release with a `BUILD_VERSION` bump. **The moments library is re-shot after every release**, so the gallery
becomes a before/after record and the audit scores can be re-taken to show progress.

## Files

- `validation/tools/moments.js` (add `--video`, the missing flows and the `--size` set), `validation/tools/moments-page.html`
  (show clips and the scorecard), `validation/tools/README.md`
- New: `docs/ui/POLISH_AUDIT.md`; update `docs/README.md` and `docs/HANDOVER.md` (Next)
- No game files change during the audit itself. Phase 4 tracks touch game files only after sign-off, one release each.

## Verification

- `npm test` stays green (the audit adds tools and docs only); `node validation/tools/moments.js` runs clean on
  every flow, with no page errors (one run showed engine errors after the DEV K.O. preview, which needs checking:
  is it a real `revealHoleCardsAnimated` bug or only the DEV path?).
- The audit page opens on the owner's phone with every image and clip loading; the scores add up; the owner's
  verdicts show beside mine.
- Re-shoot after each Phase 4 release and compare scores.
