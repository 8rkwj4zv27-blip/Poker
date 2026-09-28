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
