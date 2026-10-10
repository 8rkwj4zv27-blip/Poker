# Character Chatter — visual and audio prototype checkpoint

Raised 2026-08-28; focused owner review completed 2026-09-02. **Prototype only.
Not a Career milestone, not a Phase, and not implemented in the game.** No
Career save, unlock, roster, scoring or table code was touched by this pass, and
the Immediate next task in `STATUS.md` is unchanged by it.

## What this is

A Design Lab for evaluating how short ambient character chatter should look and
sound on the production table. The presentation question is now answered; the
character, dialogue, memory and emotion design is paused and remains undecided.
This Lab does not ship a dialogue system.

## Owner decision checkpoint — retain for the next pass

The owner selected **E1 — Elastic / Clean** as the production direction.

- A speaker-owned cream/white speech bubble sits above the relevant seat.
- The shape is boxy pixel art: square-edged with only a tiny corner radius. It
  must never become circular or balloon-like.
- A stepped pixel tail visibly identifies the speaker at left, right and centre
  seats. The centre-seat tail-loss seen in pass 8/9 is fixed in pass 10.
- The bubble opens, then its copy appears live in two- or three-character steps
  with a small block cursor. It is read as it is typed rather than appearing as
  a completed sentence.
- The speaker gets a restrained seat-rim highlight, one small portrait bump and
  the relevant expression change. The table itself does not flash or move.
- Copy is capped at 50 characters and must fit within two rendered lines.
  Overflow is an authoring error shown explicitly in the Lab; text must never be
  clipped, cut off or silently ellipsized.
- Only the centre seats move, by a tested 10px, to open the local speech lane.
  No permanent table-wide chatter area is reserved.

**E2 — Elastic / Paper-backed** remains only as the useful alternate reference:
the same bubble with a mustard and wine paper stack behind it. E1 is the winner.

Superseded or rejected directions: the Handoff/central notice treatment, the
full-width notice bar, circular bubbles, ornamental colour blips/confetti, and
the earlier broad A–F comparison set. Those should not be revived merely
because their old files or screenshots still exist.

The chosen sound is **Rapid Pixel Chatter**:

- one shared little machine/robot language for every speaker, not a different
  instrument or faux voice per character;
- a short opening click followed by rapid pitched ticks synchronised to each
  meaningful typing step, with spaces and punctuation kept silent;
- roughly five to seven audible ticks on a short line and a denser run on a
  longer line, rather than the old two- or three-blip notification sound;
- three repeating pitch cadences, a restrained periodic accent, and a slightly
  longer low finishing bloop so phrases read as `bipbipbip...BLOOP`;
- no recorded samples, speech synthesis, vowels, syllable simulation or
  intelligible language.

`validation/chatter-checks.js` is the focused safety net for this checkpoint.
It verifies the two-candidate Lab, repeated typing chatter, centre tail,
two-line/overflow contract, non-circular geometry, production isolation and the
absence of Career/save/hidden-card access. At the checkpoint, all eight checks
pass.

**SUPERSEDED FOR IDENTITY (2026-09-04).** The owner authorised the Enemy /
Personality Pass, which promoted Harry, Tony, Lucy, Nigel and Steve into
production as the canonical cast. Their names, portrait colours, resting faces,
expression vocabularies, biographies and voice fields now live in
`js/03-residents.js`, and this Lab's `js/chatter/01-residents.js` is a thin
adapter over that record rather than a second editable list. See
`docs/ENEMY_PERSONALITY_PASS.md`. The paragraph below is retained as the record
of what was true before that decision; the dialogue, memory and emotion design
it describes remains genuinely paused and unapproved.

**Paused deliberately:** Harry, Tony, Lucy, Nigel and Steve are still fixture
names. None of the subsequent characterisation or dialogue discussion—including
the dark-comedy Tony direction—is approved canon. When this work resumes, begin
with the character/cast decision rather than treating prototype lines as copy to
ship.

## Opening it

Serve the project over HTTP and open `chatter-lab.html` — for example
`python3 -m http.server 8123` and then `http://localhost:8123/chatter-lab.html`.
A server is required because the preview is a real production screen running in
an iframe, and `file://` blocks the shell from reaching into it.

**The preview is the production table screen, not a mock-up.** `chatter-stage.html`
is `index.html`'s `#table-screen` markup verbatim — same ids, same classes, same
six stylesheets in the same order — dressed with fixture state (a board, a pot,
seated residents, HUD instruments). It runs in its own iframe viewport, which is
the only way the orientation and width/height media queries in
`05-responsive-and-arcade.css` fire the way they do on a phone. Judging chatter
at desktop width against a scaled-down table was the central failure of the first
pass.

The focused Lab shows a real-size phone preview beside its controls. Device
buttons cover 393 × 852, 430 × 932 and the short 375 × 667 stress case.

Keyboard: `1`–`2` choose E1/E2, `M` mutes, `Space` replays the current sample,
and `[` / `]` vary the table between four and six opponent positions. Shortcuts
keep working after the phone itself has been clicked because the stage forwards
key events out.

## Prototype cast

Harry, Tony, Lucy, Nigel, Steve — five fixture residents with a fixed portrait
colour, a resting expression and an expression vocabulary drawn entirely from
the shipped `FACE_ART` pack.

They are **the production cast** as of the Enemy / Personality Pass; this file's
own copy of them is gone and the Lab reads the production registry. What follows
was written when they were prototype fixtures. Phase 7 remains
as specified in `CAREER_DESIGN.md`: it replaces the anonymous field with authored
named residents and adds the three relationship counters. Nothing here pre-empts
that decision — `ChatterResidents` already carries inert `venues`, `rivals` and
`record` fields so the Phase 7 shape drops straight in.

## Anti-tell contract

Not one authored line refers to a hole card, an equity, a pending decision or
anything else the speaker could not know from public table events. This is the
same contract the presentation-mood system already holds (`FACE_MOOD_POOLS`,
`js/02-support-systems.js`) and it must survive any expansion of the line
library.

## The chatter voice

The current sound is the Rapid Pixel Chatter described in the owner checkpoint
above. It replaced the earlier sparse two-to-four-beat creature-voice experiment.
The voice carries only the fact that somebody spoke; future character identity
must come from portrait, expression and writing rather than character-specific
instruments.

## Speaker animation

Restrained on purpose: the speaker's seat rim warms, the portrait makes one
small stepped bump, and the expression changes. That is the entire vocabulary —
no flashing, glow, looping pulse or table movement.

## Pacing experiment (not selected product behaviour)

The earlier prototype director, line catalogue and pacing simulation remain in
`js/chatter/02-lines.js` and `js/chatter/04-director.js` as reference material,
but the focused pass-10 stage does not load them. Their cooldowns, percentages,
trigger list, exchanges and fixture dialogue are not approved production rules.
The only retained principle is that table talk should be sparse and should say
no far more often than it speaks.

## Where integration would land

Deliberately **not** done in this pass. The hook already exists:
`bubblesAllowed(trigger)` in `js/03-opponents.js` currently returns `false` for
everything, with a comment reserving the decision for "a dedicated *speech as a
rare event* pass". That function, and `maybeTableTalk()` beside it, are where a
chosen treatment would attach — by allow-listing specific triggers rather than
by flipping a boolean.

## Files

| File | Role |
|---|---|
| `chatter-lab.html` | the Lab shell — phone pane, controls, preview mode |
| `js/chatter-lab.js` | shell: device sizing, focused controls and keyboard map |
| `css/chatter-lab.css` | Lab chrome only — loads no game stylesheet |
| `chatter-stage.html` | **the production table screen**, run in its own iframe viewport |
| `js/chatter-stage.js` | fixture state, portraits, and the API the shell drives |
| `css/chatter-stage.css` | fixture-only stand-ins (the bank chip tower, the empty chair) |
| `css/chatter-system.css` | selected E1 bubble and retained E2 alternate |
| `js/chatter/01-residents.js` | resident registry |
| `js/chatter/02-lines.js` | superseded prototype line library; retained, not loaded |
| `js/chatter/03-voice.js` | selected Rapid Pixel Chatter instrument |
| `js/chatter/04-director.js` | earlier pacing experiment; retained, not loaded |
| `js/chatter/05-presenters.js` | focused E1 winner and E2 alternate |

The shell loads no game stylesheet and no game script at all. The stage loads
exactly one production script, `js/02-support-systems.js`, and calls only
`renderFace()` and `pixelHeartSVG()` from it — face-expression sync has to be
judged on the art that actually ships.

A six-handed table renders six seat boxes but seats only the five residents; the
sixth chair is an empty socket rather than a duplicated identity, which would
give two chairs the same id and quietly break every presenter's per-seat lookup.
The geometry under test is the box spacing, and five speakers across six of the
tightest positions exercise every adjacent pair that matters.
