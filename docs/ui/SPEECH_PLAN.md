# Speech plan: table talk that reads

Opponents with personalities need somewhere to say things. The old floating
action bubbles were switched off (`bubblesAllowed()` in
`js/03-opponents.js` returns `false`), and `TABLE_TALK` has been silent
since. This plan brings speech back as a rare, readable event.

Wider direction (discussed with the owner 2026-09-28, not yet approved as
a build): a small speech director (when anyone speaks, on a budget), a
tagged line bank (what they say), a cast sheet (who they are), and later
memory (this table from `g.reads`; across sessions only if the owner
unshelves that part of Phase 7). No dialogue trees, no player replies, no
friendship meters.

## Round 1: Speech Lab (2026-09-28)

**Question:** where does a line of speech go on the table, and what does
it look like, so it is clear and easy to read and plainly comes from a
face? Timing is deliberately out of scope for this round.

**Link:** https://claude.ai/artifact/3G2mfV8qvfJrf3Tere8dP7
(re-stage with `node validation/tools/lab-bundle.js speech-lab.html
<scratchpad>/bundle-speech` and republish to the same link.)

Files (lab only, nothing in the game loads them):
- `speech-lab.html` + `js/speech-lab-host.js`: the page, the real game
  full screen (the Showdown Lab pattern).
- `js/speech-lab.js`: the TUNE and SAY keys, the bottom sheet, and the
  candidate bubbles. Wraps `applyAction` to hear who acted; the speaker's
  face changes through the game's own `playReactionSequence`.
- `css/speech-lab.css`: the bubbles' finishes and the lab controls.
- `js/speech-lines.js`: a first pass at the cast's voices (below).

How it plays: an ordinary hand; about a second after the chosen opponent
first acts in a hand, they say a line that fits what they did (bet,
call/check or fold) and their face changes to match it. SAY makes them
say another straight away. Tap a bubble to dismiss it.

Options (first of each is my suggestion):

| Row | Options |
|---|---|
| WHERE | FROM THE SEAT (off their seat, tail at the face) · FIXED LANE (one wide bubble across the upper felt, tail reaches the speaker) · CLOSE-UP (their face, big, over the lower felt, bubble beside it) |
| LOOK | CARD STOCK (cream, like the cards) · DARK GLASS (gold ink, like the screens) |
| WHO SPEAKS | TOP SEAT · LEFT SEAT · RIGHT SEAT |
| LINES | SHORT · LONG (worst case) |
| TEXT | ALL AT ONCE · TYPES ON |
| OPPONENTS | 4 · 6 |

Checked in an emulated iPhone with real touch at 390×844 and 375×667,
4 and 6 opponents, every WHERE × LOOK: no console errors, bubbles stay
inside the felt. On a 375×667 phone the lane and close-up overlap the
board area; that's the real cost of those two on small screens.

The bubble is a candidate new Pattern Book part: once the owner picks,
it's signed off and added to `docs/ui/PATTERN_BOOK.md` (and
`validation/pattern-book-checks.js`) before it goes in the game.

## Round 1 picks (owner, 2026-09-28)

```
WHERE: CLOSE-UP · LOOK: CARD STOCK · WHO SPEAKS: LEFT SEAT
LINES: SHORT · TEXT: TYPES ON · OPPONENTS: 6
```

Feedback: the close-up face is too big; the bubble should size to what
they say; they need creature speech (Hollow Knight, Nintendo, Minions),
no words. Lines: GTA mixed with Snatch and Sexy Beast, less syrupy.
"The numbers are delighted" and "writing it down in pen" were bad;
Bournemouth was funny.

## The voice (round 1 lines)

Owner's brief: rough, funny British table in the spirit of the early
top-down GTA games. Fun, serious, cartoony, a bit satirical, subtle.

What made that writing work, and the rules the lines follow:
- **Deadpan.** The character means it; the joke is ours. No winking.
- **Specific and ordinary.** A bus pass, the depot, Bournemouth, the
  recycling, a tab at the Crown. Never a poker pun.
- **Menace and pettiness, politely.** Bruno is courteous and alarming;
  Nigel keeps receipts.
- **Short.** One thought, no explanation after it.
- **Slang sparingly.** The London 1969 expansion is the warning: its
  dialogue was widely mocked as cockney slang pinned on a dartboard. One
  bit of slang per character, at most.

The cast as written (names from `PERSONALITIES_ALL`):
Nigel (rock): Neighbourhood Watch, keeps receipts ·
Lucy (shark): cold, polished, never raises her voice ·
Tony (maniac): wide boy, owes somebody money ·
Mavis (station): somebody's nan, calls everything ·
Steve (grinder): nights at the depot, patient ·
Roxy (wildcard): bored, in it for the chaos ·
Harry (professor): pompous, quietly wrong ·
Bruno (hammer): very polite, very large, remembers everything.


## Round 2: the close-up and the voices (2026-09-28)

Same link, republished. Close-up and card stock are locked in. New rows
(first of each is my suggestion):

| Row | Options |
|---|---|
| FACE SIZE | MEDIUM 72px · SMALL 56px · LARGE 96px (round 1) |
| BUBBLE SIZE | FITS THE LINE · GROWS AS IT TYPES · FULL WIDTH (round 1) |
| FACE FRAME | THEIR COLOUR (their seat cabinet's) · GOLD · NO FRAME |
| NAME | UNDER THE FACE · IN THE BUBBLE · NONE |
| HEIGHT | LOW (just above your hole cards) · MIDDLE (between seats and board) |
| SIDE | THEIR SIDE · ALWAYS LEFT |
| ARRIVAL | RISES UP · SLIDES IN · POPS |
| VOICE | CREATURE · BLIPS · GRUMBLE · OFF |
| VOLUME | MEDIUM · LOW · HIGH |
| TALKING PACE | THEIR OWN · EVERYONE THE SAME |
| WHO SPEAKS | LEFT · TOP · RIGHT · ANYONE (a different one each hand) |

**The voices** (`js/speech-voice.js`, lab only): procedural Web Audio,
no samples. A line is spoken as gibberish built from its own vowels (one
syllable per vowel group, through two vowel filters, with a consonant
click), so it replays the same each time and the typing and the voice
share one letter-by-letter timing plan (pauses at commas and full
stops). Each character has a pitch, range, pace and quirk: Bruno very
low and slow, Mavis high with a warble, Tony fast and bouncy, Lucy and
Bruno closing every phrase down, Harry lifting to make a point. The
line's face bends it: angry lower and louder, nervous wobbles, smug
slides down, a question rises. Own AudioContext (the game's `Sound`
keeps its private), gated by the sound setting, unlocked by the first
tap for iOS. Measured offline (`SpeechVoice.measure`): every character
peaks at about 0.3 at MEDIUM, 0.62 at HIGH on an angry line: even
across the cast, never clipping.

**The lines, round 2:** rewritten to the new brief (see the rules at
the top of `js/speech-lines.js`): people mean it, ordinary detail
carries the menace or the sadness, say less, slang rare. Five short and
two long lines per character per action, 168 in all. Bournemouth kept
(Mavis now brings Derek up twice).

Checked in an emulated iPhone at 390×844 and 375×667, six opponents:
every row renders, no console errors; the LOW close-up now sits above
your hole cards. On a 375×667 phone it covers part of the board area;
MIDDLE sits over the bets instead. Timing is still a placeholder.

## Round 2 picks (owner, 2026-09-28)

```
FACE SIZE: MEDIUM · BUBBLE SIZE: GROWS AS IT TYPES · FACE FRAME: THEIR COLOUR
NAME: UNDER THE FACE · HEIGHT: LOW · SIDE: THEIR SIDE · ARRIVAL: POPS
VOICE: BLIPS · VOLUME: LOW · TALKING PACE: EVERYONE THE SAME
WHO SPEAKS: ANYONE · LINES: LONG · TEXT: TYPES ON · OPPONENTS: 4
```

Feedback: the creature and grumble voices were "a bit scary"; blips are
the best, and the owner wants more choices for them. The close-up
"feels good". Next, after the sound: darker lines (below), and possibly
new or better-animated faces later.

## Round 3: blip choices (2026-09-28)

Same link. The whole close-up is locked in (round 2's picks); the
creature and grumble voices are gone. `js/speech-voice.js` is blips only:

| Row | Options |
|---|---|
| SOUND | PIP (round 2's square beep) · SOFT (rounded triangle) · CHIRP (drops onto its note) · WOOD (a little marimba) · BELL (music box) · MACHINE (a teleprinter tick with a tiny tone) |
| HOW OFTEN | EVERY OTHER LETTER (round 2) · EVERY LETTER · EVERY SYLLABLE |
| MELODY | IN TUNE (a five-note scale, so a line is a little tune) · FREE (round 2) · ONE NOTE |
| PITCH | THEIR OWN (Bruno low, Mavis high) · ALL THE SAME |
| VOLUME / TALKING PACE | as round 2, defaulting to the owner's LOW and EVERYONE THE SAME |

Levels are matched to the pip the owner picked (measured offline: every
sound peaks 0.10-0.16 at LOW, rms within ~1.5x; square waves read
louder than sines at the same peak, so the sine sounds sit a touch
higher). Changing any blip row plays a sample line.

## Parked for after the sound

**Darker lines.** Owner's brief: comically dark now and then: sadness
("I'm literally in my overdraft"), a bit of threat ("I'll break your
legs"), a bit depraved, Limmy rather than Deadpool; down-to-earth
enough to genuinely shock, and rare. That needs moments the lab doesn't
have yet: *losing a big pot to you*, *going bust*, *a big loss in
general*. Those are where the dark lines belong (an action line stays
mostly ordinary). Plan: add those moments to the lab (they're public
events: showdown result, stack change, elimination), then write a dark
tier per character that fires only on them, with a rarity dial.

**Faces.** The portraits are pixel PNGs (`assets/faces/`) recoloured per
seat. New expressions can be drawn to match the existing art (a
separate art task, best done in its own lab with the owner reviewing
each face). Cheaper animation first: a mouth-open frame flapping in time
with the blips, and blinks. Later, its own pass.

## Round 4: a blip each (2026-09-28)

Owner: "each character should have their own sound"; the blips "sound
good and work really well when they talk". SOUND now defaults to THEIR
OWN (the single-sound options stay for comparison):

| Character | Blip | Pitch |
|---|---|---|
| Nigel (rock) | machine (teleprinter tick) | 330 Hz, level |
| Lucy (shark) | bell | 440 Hz, closes down |
| Tony (maniac) | chirp | 370 Hz, fast, wide |
| Mavis (station) | soft | 560 Hz |
| Steve (grinder) | pip | 300 Hz, level |
| Roxy (wildcard) | chirp | 520 Hz, fast, widest |
| Harry (professor) | machine | 350 Hz, closes down |
| Bruno (hammer) | wood (a knock) | 196 Hz, slow |

Six sounds for eight people: Tony/Roxy and Nigel/Harry share, told apart
by pitch and range. Measured offline at LOW: every character peaks
0.09-0.16.

## Round 5: one family of blips (2026-09-28)

Owner: back to back, the sounds "sound a bit funny", especially Bell;
keep each direction but bring them closer. Every blip is now a shared
core (a warm, filtered square pip) with the character's flavour mixed
on top, both through the same warm filter. A new row, HOW DIFFERENT
(`family`), sets how much flavour: CLOSE 0.5 (default) · CLOSER 0.3 ·
A BIT APART 0.7 · ROUND 4 (1, the sounds exactly as they were). The same
dial also pulls the characters' pitches toward the middle (330 Hz) and
narrows how far each voice wanders. Below full flavour the bell stays on
its note (no octave jump) and rings for about a third as long.

Measured offline across the eight (one long line each, LOW volume):
loudness spread 3.0x at ROUND 4, 2.1x A BIT APART, 1.7x CLOSE, 1.5x
CLOSER; how long each blip rings, 4.7x down to about 2x. A brightness
figure (zero crossings) proved too noisy to judge by; the owner's ear
is the test.

## Round 6: one volume, the player's (2026-09-28)

Owner: round 5 "all looks good"; the characters "should all be the same
volume and that should be adjustable by the player". The whole blip
voice is now locked in (a sound each, CLOSE family, every other letter,
in tune, their own pitch, everyone the same pace).

**Same loudness.** Level meters lie to the ear (a low knock sounds
quieter than a bright chirp at the same level), so each character was
measured through an ear-weighted filter (roughly the K-weighting loudness
meters use: `SpeechVoice.measure(..., weighted)`) over five lines, and
given a `trim` to the cast's average. Spread before: 1.7x; after:
1.05x. The mood no longer changes the level (it still nudges pitch).
The trims hold for the locked blip settings; re-measure if a sound or
the family changes.

**The player's volume.** TABLE TALK VOLUME: LOW (default, the owner's
pick) · MEDIUM · HIGH · SILENT (the bubbles still talk, no blips). In
the game this goes in Settings next to the existing Table Talk switch,
saved with the other settings.
