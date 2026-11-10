# Next level plan: big bold moves

Owner's brief, 10 November 2026: make Poker Faces feel like a *video game*
rather than an HTML app. Mini games (Blackjack first), unlockable
customisation found in packs and won at the table, character moments
(a beaten opponent turns up in the hub demanding a rematch), unique
events and tournament invitations, a proper showdown screen, more FX and
"little moments", 2D shaded lighting done a new way, packs, event cards,
chips and opponents that look amazing, and a dashboard the player can make
their own. Plus a tidy-up, rules, skills and better use of Claude.

**Status (10 Nov): the owner chose the Light Lab, then Rivals; WebGL by
hand (no PixiJS for now). Stage 1 is built (below); the other decisions in
section 9 are still open.** Stages are listed in the recommended order;
each one ships on its own and follows `WORKFLOW.md`.

---

## 1. Where we start (checked against the repo, 10 Nov)

- v0.71.4, about six weeks of work (v0.39 on 24 Sep to now), 65k lines
  of JS/CSS, no dependencies, no build step, 25 test suites + 9 browser
  checks. Poker correctness is well protected.
- Rendering is DOM + CSS, with 2D canvas only for chips (`coin-world.js`),
  the packet (`pack-opening-packet.js`), P.I.P.'s TV and the K.O. screen.
  No WebGL. Earlier "lighting" is CSS gradients and rim-light layers:
  this is why it reads as an app.
- Process weighs as much as the product: 53 docs (~139k words), a 12k-word
  `CODEMAP.md`, 19 labs at the repo root, ~79 remote branches. The
  rules are right but nothing enforces them, so they drift.
- Two Careers ship side by side (classic and new). Money in the new
  Career has nothing to buy (`HANDOVER.md`, Open items).
- Already in place to build on: named residents with stable rosters
  (classic Career), `showdown.js` / `showdown-beats.js` and the showdown
  lab, the Workshop's skins, packets / the vending machine / the album,
  the event catalogue and formats, P.I.P.

## 2. The big idea: a lit stage, a console, and a cast

Three layers, each with one job:

1. **The Stage** (new): one WebGL canvas behind the table showing the felt,
   cards, chips, opponents and props, rendered at a low internal
   resolution and scaled up crisp (`image-rendering: pixelated`), lit by
   *real* lights: the lamp over the table, each seat's rim light, flashes
   for events. Every sprite has a **normal map**, so light rakes across
   chip edges, card embossing and faces as it moves. Then a small set of
   post effects: bloom on lamps and foil, a vignette, and the CRT finish
   where the Pattern Book already uses one. This is the "not like before"
   lighting: lights are objects that move, flicker and react, not
   painted gradients.
2. **The Console** (stays DOM): the dense player console, keys, readouts
   and text stay as they are. That's what DOM is good at and it's already
   tactile. It gains customisable parts (Stage 4).
3. **The Cast and the Director** (new systems): opponents remember you,
   and a *moment director* decides when something special happens (a
   rivalry callout, a lamp flicker, a dealer quirk, a big-hand FX), with
   a budget so moments stay rare. Rarity is what keeps them special, and
   it's the same rule as sparse table talk.

Why this direction: it's the HD-2D recipe (pixel sprites + modern
lighting + bloom), adapted to a tabletop. It keeps the pixel art the owner
draws and makes it feel physical. It's also the fastest route from "HTML
app" to "video game", because light and motion do most of that work.

## 3. Stages

### Stage 0 — Tidy, rules and tooling (first, small, no gameplay change)

Goal: every later stage is cheaper and safer.

- **Skills** in `.claude/skills/` (each a short `SKILL.md`, loaded only
  when relevant): `release` (version bumps, cache list, changelog,
  handover, tests), `lab` (phone-first lab, touch check, bundle, Artifact
  link), `pattern-book`, `poker-rules` (correctness checklist and sims
  for Hold'em *and* Blackjack), `character-voice` (each opponent's
  voice, moods, how rare talk is, good and bad examples), `moments`
  (the director's budget and the catalogue), `art-pipeline` (palette,
  sizes, normal maps, `art-source/` vs `assets/`), `motion` (the approved
  timings, easings and stepped frames taken from shipped labs).
- **Subagents** in `.claude/agents/`: `rules-reviewer` (poker/blackjack
  correctness on any engine diff), `art-director` (screenshots a change
  in the emulated iPhone and checks it against the art direction and
  Pattern Book), `phone-qa` (runs the touch harness and play-test).
  This is `WORKFLOW.md`'s step 3 "independent review", made routine.
- **Hooks** in `.claude/settings.json`: run `npm run test:quick` before a
  commit; run `version-checks.js` when `js/`, `css/`, `index.html` or
  `sw.js` change. These enforce the rules, so they stop drifting.
- **Slim `CLAUDE.md`** to principles and art direction; move procedures
  (release, labs, housekeeping) into the skills above.
- **Archive labs** whose features shipped and that no suite reads, to
  `checkpoint/labs-archive-2026-10` (the existing rule, finally applied).
- **Lab-only code** out of `pack-opening.js` and `vending-machine.js`;
  stale comments fixed (`coach-report.js`, `coach-report.css`,
  `bank-load.js`).
- **Play log** (local only, exportable from Save data): hands, minutes per
  hand, folds, all-ins, events entered and won, coach taps. Lets us
  design from the owner's real play. It's a new saved key, so it joins
  `SaveData.KEYS`.
- Optional (owner decision): retire the classic Career's code while
  keeping its save (`felt.career`) readable and backed up.

### Stage 1 — The Light Lab (a spike; a decision gate)

**Built 10 Nov (owner: "build the Light Lab, then Rivals").** `light-lab.html`,
hand-written WebGL (no dependency). Link for the phone:
https://claude.ai/artifact/R7sMs3aMcMuecgfDrQ1cC4. Waiting for the owner's
verdict (go / change / stop). Frame rate was not measured on a real iPhone
(the cloud browser renders WebGL in software); the ABOUT tab shows it live.

Goal: prove the lit Stage on the owner's iPhone before committing to it.

- One lab: the felt, the lamp, one opponent face, a chip stack and two
  cards, lit for real. Controls in the TUNE sheet: lamp height and swing,
  light colour, normal strength, bloom, internal resolution (1/2, 1/3,
  1/4), CRT on/off.
- Normal maps: generated from the existing PNGs (Laigter, free and
  open-source, or a height-from-shading script) and hand-touched where it
  matters (faces).
- Measure on the phone: frame time, battery feel, heat, load time.
  Fallback: if WebGL isn't available, the current CSS look.
- **Gate:** the owner plays it and says go / change / stop. Only on "go"
  does the Stage replace the felt in the game (Stage 1b), piece by piece:
  felt and lamp first, then chips (moving `coin-world` drawing onto the
  Stage), then cards, then faces.

### Stage 2 — Rivals and callouts (character)

Goal: opponents remember you, and it shows. *(This un-parks "resident
relationships", Career Phase 7, at the owner's request of 10 Nov.)*

- Each opponent keeps a small **ledger** of you: hands and events played,
  who won, the biggest pot, bad beats, being bluffed, a grudge or respect
  level. Saved with the Career, with a version bump and migration.
- **Callouts:** after you beat someone, they can turn up in the hub. They
  walk in, slam a **Rematch** invitation on the felt and say one line in
  their own voice. Ignore it and they come back angrier (higher stakes);
  beat them twice and they go quiet or start respecting you.
- **Rematch formats** reuse the duels (Face to Face, Last Stack Wins),
  with their own stakes ("double or nothing on what you took").
- Mood carries into the table: a rival who lost to you plays tilted for a
  few hands. The AI reads the ledger as one input. Their tier stays the
  same, so difficulty stays honest.
- Table talk stays sparse: callouts and grudge lines go through the
  moment director's budget.

### Stage 3 — Showdown moments and the FX director

Goal: the big hands feel like events.

- **A proper showdown screen** for pots that matter (an all-in, the
  biggest pot of the session, an event's last hand): the house lights
  drop, the lamp swings in, the camera pushes onto the felt, cards turn
  one by one with a beat between, faces react, and the winner's chips
  pour across under the light. Ordinary hands keep the quick showdown.
- **Big-hand FX** by rarity: two pair is a click; a full house is a lamp
  surge; quads shake the table; a straight flush or royal is a full
  blackout-to-flare with a chip fountain. Tuned in a lab and bounded so
  it stays fun on the hundredth time.
- **Little moments catalogue** (the director picks, rarely): the lamp
  flickers, a chip tower topples, the dealer squares the deck, an opponent
  checks their watch, a fly lands on the felt, the machine hiccups and
  P.I.P. thumps his TV. Each is small, cheap and rare. The `moments`
  skill holds the catalogue and the budget.

### Stage 4 — Your machine (customisation and unlocks)

Goal: the player's console becomes *theirs*, and money gets a purpose.

- **Parts** the player can change: key caps, the rim lamp colour, the CRT
  tint and finish, the felt cloth and printing, card backs, chip sets,
  the dealer's deck, the frame's velvet and trim, and sounds (key clicks,
  coin sound). Each part is a set of Pattern Book tokens, not new local
  styling, so everything still matches.
- **Where parts come from:** packets (a new card type in the album:
  *parts*), event prizes ("win the Velvet Cup, get its felt"), rival
  trophies (beat a rival three times, take their lucky card back), and
  rare finds in mini games. Cosmetic only: nothing changes the odds.
- **The Workshop becomes a bench:** your machine on a bench under a lamp
  (the Stage lights it), parts in drawers, fit a part and see it.
- This fixes the open economy item: chips buy packets, and packets
  hold parts as well as invitations.

### Stage 5 — Side machines: Blackjack and mini games

Goal: variety between events, still in the machine's world.

- **Blackjack** first, as its own small cabinet in the hub, run by a
  house dealer with a personality. Real rules (dealer stands on soft 17
  or hits, the owner picks; doubles, splits, insurance optional), its
  own correctness suite like Hold'em's (`blackjack-truth-checks.js`), and
  shared chips so a hot streak matters.
- **Mini games**, each short (under a minute), physical and rare
  enough to feel like a find: *High Card Cut* (cut the deck against the
  dealer for a stake), *Chip Flick* (flick a chip across the felt onto a
  spot, using the existing chip physics), *Read the Tell* (spot which
  face is bluffing; P.I.P. teaches it), and *the Claw* (a pixel crane in
  the vending machine for a part). They appear as hub visitors or
  between event hands, not as a menu of apps.
- Guard rail (`CLAUDE.md`: no generic mobile-game mechanics): no
  timers, energy or daily streaks. Each mini game is a physical machine
  you choose to play.

### Stage 6 — Events and tournament invitations

Goal: the invitation Career gets a spine and some surprises.

- **Special-rule events** (already in Next) that keep hand evaluation
  untouched: *Bounty* (a prize per knockout), *Mystery Bounty*, *Blackout*
  (only the lamp lit, and tells are harder to read), *Ante Up*, *Last
  Orbit* (blinds double every orbit), *Rival Night* (your rivals'
  table). Rule changes that alter rankings, like Short Deck, only with
  their own truth-checks.
- **Tournament invitations:** a gold card that opens a short ladder of
  events (heat, semi, final) with a trophy, a part and a rival at the
  end. This answers "the new Career's goal": the album fills with
  trophies and the tournament card is the climax of each tier.
- End screens per format (deferred by the owner) come in here.

### Stage 7 — Packs, cards, chips and faces glow-up

Goal: the collectables look amazing. Built on the Stage's lighting.

- **Foil** that reacts to the phone's tilt (iOS asks permission once for
  motion) or to the finger, with a holo shader on rare invitation and
  part cards.
- Packets rip under the lamp with specular on the wrapper; a rare pull
  gets a light flare and a pause.
- Chips: normal-mapped edges and inlays, so towers catch the lamp.
- Opponents: expression sets per mood (neutral, smug, nervous, tilted,
  furious, beaten), blinks, breathing idle, and a lit rim from their
  seat's light. The owner draws the key frames; tools fill in the
  in-betweens (section 5).

## 4. Using Claude better

- **The right model for the job.** Use Fable 5.2 (the free resets) on the
  hard, long, architectural pieces: the Stage renderer (Stage 1/1b), the
  rival ledger and moment director (2/3), and Blackjack's engine and its
  truth-checks (5). Opus 5.5 is fine for content, polish, labs and
  releases. Fable 5.2 is built for long agentic runs and checks its own
  work, so give it a whole stage with its acceptance checks, not a
  sequence of small asks.
- **Parallel sessions, one per workstream**, each on its own branch:
  e.g. *Stage* (rendering), *Cast* (rivals and moments), *Content*
  (lines, events, parts catalogue). They merge through pull requests
  with `npm test` green. They must not overlap files: the skill for
  each stage lists which files it owns.
- **Comment on labs from your phone.** Published lab Artifacts take
  comments. Leave notes on the page itself ("lamp too orange", "slower
  flip"), and the session reads them and makes the changes, so you don't
  have to type feedback into chat.
- **Subagents as reviewers** (Stage 0) for correctness, art direction and
  phone QA on every stage, so review isn't skipped when a session is
  busy.
- **A weekly tidy check** as a scheduled task: labs to archive, stale
  docs, branch count, open items older than a month. It reports only and
  changes nothing without the owner.

## 5. Tools and connectors (what to add, and where it runs)

| Tool | For | Where | Verdict |
| --- | --- | --- | --- |
| GitHub (connected) | Branches, PRs, reviews | Everywhere | Keep |
| **PixelLab MCP** (hosted, API token) | Pixel sprite variants, expressions, animation in-betweens, props, part art | Cloud or local; needs the token and host allowed | Try in Stage 7 / 4 for *variants and props*, owner's art stays the master |
| **Aseprite MCP** (open source) | Claude edits real `.aseprite` files: palettes, shading ramps, outlines, frames, with previews | Local only (needs Aseprite on your computer) | Best for touching up and animating the owner's own faces |
| **Laigter** (free app) | Normal maps from sprites, with live light preview | Local app | Stage 1; no connector needed |
| **ElevenLabs MCP** or a retro sfx MCP | Auditioning sound ideas | Hosted API / local | Audition only; rebuild winners as Web Audio recipes (no files, offline) |
| Claude Docs (connected) | Living design docs the owner comments on | Everywhere | Use for the rival lines and parts catalogue |
| Figma, Notion, Linear, Adobe (installed) | Mock-ups, backlog | Failed to connect in this cloud session (network policy refused them) | Only fix if you'll use them. Labs on the phone beat Figma for this game |

Notes: the cloud environment blocks hosts that aren't allowed, so a hosted
connector (PixelLab, ElevenLabs) needs its host added and a credential
saved. That's a one-time approval when we first use it. Third-party MCPs
should have their repos checked before installing. The community "game
studio" plugins (dozens of agents) are built for Unity/Godot projects and
would add more process, not less. Our own small skills fit better.

## 6. Art pipeline (pixel art, used well)

- The owner draws the masters: faces, key props, the look. AI tools make
  *variants of the owner's art* (expressions, palette swaps, in-between
  frames), never the hero art from scratch. That's how the game keeps
  one hand.
- One locked palette per material (velvet, felt, brass, cream card, chip
  inks), held in `art-source/palettes/` and checked by a test that every
  shipped PNG uses it.
- Every lit sprite ships with its normal map (`*_n.png`) at the same size.
  The pixel grid is sacred: no resampling, no anti-aliasing on the Stage;
  bloom and glow are the only soft things.
- Sizes on a fixed grid (the Stage's internal resolution) so pixels stay
  square on every iPhone.

## 7. Risks

- **iPhone performance and battery** with a WebGL Stage: hence the Light
  Lab gate, a low internal resolution, a 30fps idle mode, and the CSS look
  as a fallback.
- **Scope.** This is months of work. Each stage ships alone, and none
  starts before the previous one is signed off. Stage 0 cuts the overhead
  first.
- **Save data.** Rival ledgers, parts and the play log are new or
  changed saved data: version bumps, migrations, `SaveData.KEYS`, and
  backups keep working.
- **Correctness.** Blackjack and any rule-changing event get truth-check
  suites before they ship.
- **Taste drift.** Generated art can pull away from the owner's style. The
  owner signs off every generated asset, and the palette test catches the
  rest.

## 8. Rules this plan adds (once approved, into `CLAUDE.md` or skills)

- The Stage draws; the Console controls; the Director decides moments.
  Game state stays in the engine and presentation never changes it (as
  now).
- Moments have a budget: at most one director moment per few hands,
  tuned in the play log.
- Unlocks are cosmetic. Nothing bought or won changes the odds.
- Every new game (Blackjack, mini games) ships with a truth-check suite.
- Every lit sprite has a normal map and passes the palette test.

## 9. Decisions for the owner

1. **The Stage:** go ahead with the Light Lab (Stage 1) as the lighting
   approach? *(Recommended.)*
2. **Dependencies:** write the WebGL Stage by hand (no dependency; the lab
   needs only a few hundred lines), or approve PixiJS (faster to build
   a full scene, but the first dependency)? *Recommended: by hand for the
   lab; decide after the gate.*
3. **Order:** Stage 0, then 1 and 2 in parallel (rendering and rivals
   don't touch the same files), then 3 to 7? Or something else first,
   e.g. Blackjack?
4. **Classic Career:** retire its code in Stage 0 (its save kept and
   backed up)?
5. **Branches:** back up the unbacked `claude/` branches to `checkpoint/`
   and delete the merged ones (you chose to leave them on 7 Oct)?
6. **Art tools:** try PixelLab (paid, hosted) and/or the Aseprite MCP
   (local, needs Aseprite)? Which of your faces may it make variants of?
7. **Blackjack house rules:** dealer hits or stands on soft 17; doubling
   after a split; insurance on or off.
