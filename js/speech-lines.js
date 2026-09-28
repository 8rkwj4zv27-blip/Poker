"use strict";

/* ============================================================
   SPEECH LAB — the lines (round 1, lab only)

   A first pass at the cast's voices, written for the Speech Lab so the
   bubbles have real lines to carry. Not the game's line bank: nothing in
   the game loads this file.

   The brief (owner, 2026-09-28): rough, funny British table, in the
   spirit of the early top-down GTA games. Deadpan, specific, a bit
   satirical, never winking. What makes that kind of line work, and the
   rules these follow:
   - Said flat. The character takes it seriously; the joke is ours.
   - Specific and ordinary: a bus pass, the depot, Bournemouth, the
     recycling. Never a poker pun.
   - Menace and pettiness said politely (Bruno, Lucy, Nigel).
   - Short. One thought, no explanation afterwards.
   - Slang sparingly. A page of "leave it out" and "you mug" reads like a
     dartboard of soap transcripts; one per character, at most.

   Keyed by personality key (03-opponents.js PERSONALITIES_ALL), then by
   what they just did: bet (bet, raise, all in), call (call, check) or
   fold; then short or long (the lab's LINES switch, to test the worst
   case). Each line carries the face the speaker wears while saying it:
   a FACE_ART key from 02-support-systems.js.
   ============================================================ */
const SPEECH_LINES = {
  // Nigel, the rock: Neighbourhood Watch, keeps receipts, folds for years
  rock: {
    bet: {
      short: [["Right. I've got something.", 'smug1'], ["Don't make this awkward.", 'suspicious1'], ['I would fold, personally.', 'sly1']],
      long:  [['I have folded forty hands for this. Forty. I counted, and so did you.', 'cocky1'],
              ["I'd fold if I were you. I'd fold if I were anyone.", 'smug1']]
    },
    call: {
      short: [['Go on, then.', 'suspicious1'], ["I'll allow it.", 'neutral2'], ['Hm.', 'suspicious2']],
      long:  [["I'll see it. But I'm writing it down, and I'm writing it in pen.", 'suspicious2'],
              ["Fine. I've complained to the council about less than this.", 'displeased1']]
    },
    fold: {
      short: [['Not today, thank you.', 'neutral3'], ['No.', 'displeased1'], ['Straight in the bin.', 'neutral4']],
      long:  [['Straight in the bin, that. The recycling, obviously. I do things properly.', 'neutral4'],
              ["I've been sensible since 1994 and I'm not stopping for you.", 'displeased1']]
    }
  },

  // Lucy, the shark: cold, polished, faintly cruel, never raises her voice
  shark: {
    bet: {
      short: [['Raise.', 'smug1'], ["Let's make it interesting. For one of us.", 'sly1'], ['Your move.', 'scheming1']],
      long:  [["You've got a lovely little tell, you know. I'm not going to say what it is.", 'scheming1'],
              ["I'd love to explain this bet to you, but I charge for lessons.", 'smug1']]
    },
    call: {
      short: [['Fine.', 'neutral1'], ['Show me, then.', 'suspicious1'], ['Sure.', 'neutral5']],
      long:  [["I'll pay to see it. Call it market research.", 'sly1'],
              ["Calling. I just want to see what you think a good hand is.", 'suspicious2']]
    },
    fold: {
      short: [['Keep it.', 'neutral5'], ['Enjoy that.', 'smug1'], ['Cute.', 'sly1']],
      long:  [["Take it. From what I've seen, you'll need it more than I do.", 'smug1'],
              ["Have that one. I'll take the next three.", 'scheming1']]
    }
  },

  // Tony, the maniac: wide boy, owes somebody money, never regrets anything
  maniac: {
    bet: {
      short: [['Up we go.', 'cocky2'], ['Have some of that.', 'manic1'], ['Raise. Don\'t tell Sharon.', 'gloating1']],
      long:  [["That's not a raise, that's a lifestyle. Ask anyone down the Crown.", 'gloating1'],
              ["Don't look at me like that. I've had worse cards and a better time.", 'cocky1']]
    },
    call: {
      short: [['Yeah, go on.', 'sly1'], ["I'm in. Obviously.", 'cocky2'], ['Why not.', 'manic1']],
      long:  [["I'm calling. I've already spent this pot, so technically it's mine.", 'happyConfused1'],
              ["I'll call. Put it on my tab. I've got a tab here, haven't I?", 'cocky1']]
    },
    fold: {
      short: [['Leave it out.', 'angry1'], ['Robbery, that.', 'displeased1'], ['Diabolical.', 'angry1']],
      long:  [["I'm folding, but I want it known I'm folding under protest.", 'displeased1'],
              ["Who dealt these? I'm not saying anything. I'm just asking who dealt these.", 'suspicious1']]
    }
  },

  // Mavis, the station: somebody's nan, calls everything, chats through it
  station: {
    bet: {
      short: [["Ooh, I'll put a bit on.", 'happy1'], ["Is this a raise? I think it's a raise.", 'confused1'], ['Go on, spoil me.', 'joyful1']],
      long:  [['My Derek never raised in his life. Look where it got him. Bournemouth.', 'joyful1'],
              ["I'll put a bit on. I've done my big shop, so it's only the bingo money.", 'happy2']]
    },
    call: {
      short: [['Oh, go on then.', 'happy1'], ["I'll see you, love.", 'happy2'], ['Just a little one.', 'relieved1']],
      long:  [["I'll come along for the ride. I've got a bus pass, I'm used to it.", 'relieved1'],
              ["I'll call, love. I don't know what I've got, but I've got it.", 'happyConfused1']]
    },
    fold: {
      short: [['Ooh, no. No.', 'worried1'], ["I'll sit this one out, love.", 'relieved1'], ['Not for me.', 'worried1']],
      long:  [["I'm out. These cards are like my knees. They've let me down before.", 'worried1'],
              ["Oh, I'll leave it. My sister says I'm too trusting, and she's a liar.", 'confused2']]
    }
  },

  // Steve, the grinder: on nights at the depot, tired, patient, practical
  grinder: {
    bet: {
      short: [['Small one.', 'neutral2'], ['Bit of pressure.', 'sly1'], ['Same again.', 'neutral3']],
      long:  [["I'm on nights all week, so I'm here a while. Might as well make it count.", 'cocky1'],
              ["Small raise. I've got a system. The system is I'm patient and you're not.", 'smug1']]
    },
    call: {
      short: [['Yeah, fine.', 'neutral3'], ['Worth a look.', 'neutral4'], ['Go on.', 'neutral1']],
      long:  [["I'll call. It's cheaper than the vending machine at work, and that's never paid out either.", 'neutral4'],
              ["Calling. Don't make it a big thing, I'm on at six.", 'neutral5']]
    },
    fold: {
      short: [['Not worth it.', 'neutral3'], ['Fair enough.', 'neutral1'], ['Next.', 'neutral4']],
      long:  [["I'm out. I'll wait for a hand that's actually a hand.", 'displeased1'],
              ["Fold. I've waited for buses longer than I'll wait for you.", 'neutral2']]
    }
  },

  // Roxy, the wildcard: bored, sharp, in it for the chaos
  wildcard: {
    bet: {
      short: [["Let's see who cries.", 'manic1'], ['Bored now. Raise.', 'sly1'], ['Oops. Raise.', 'scheming1']],
      long:  [["I haven't looked at my cards. I have, actually. Doesn't matter either way.", 'scheming1'],
              ["Raise. Someone has to make this table interesting, and it won't be you.", 'cocky2']]
    },
    call: {
      short: [['Why not.', 'sly1'], ['Sure, whatever.', 'neutral5'], ['Go on, surprise me.', 'happyConfused1']],
      long:  [["I'm calling because it's more fun than not calling. That's the whole system.", 'happyConfused1'],
              ["Call. I want to see what you've been so pleased about.", 'suspicious1']]
    },
    fold: {
      short: [['Boring.', 'neutral4'], ['Nah.', 'neutral5'], ['Wake me up later.', 'neutral3']],
      long:  [['Fold. Wake me up when somebody does something stupid.', 'neutral4'],
              ["I'm out. Not because of you. I just went off the idea.", 'sly1']]
    }
  },

  // Harry, the professor: pompous, precise, quietly wrong about most things
  professor: {
    bet: {
      short: [['Statistically, yes.', 'smug1'], ['A calculated increase.', 'scheming1'], ['The numbers insist.', 'cocky1']],
      long:  [["I've run the numbers on this twice, and the numbers are delighted.", 'gloating1'],
              ["There's a paper to be written about this hand. I intend to write it.", 'smug1']]
    },
    call: {
      short: [['Hm. Acceptable.', 'suspicious2'], ["I'll humour you.", 'smug1'], ['Proceed.', 'neutral2']],
      long:  [["Calling. Not because I believe you, but because I have questions.", 'suspicious1'],
              ["I'll call. You'll find my reasoning in the appendix.", 'smug1']]
    },
    fold: {
      short: [['A tactical withdrawal.', 'neutral1'], ['Noted, and discarded.', 'displeased1'], ['Correct fold.', 'smug1']],
      long:  [['Folding. For the record, that was correct, and history will agree with me.', 'smug1'],
              ["I'm out. I'd explain why, but you'd only nod.", 'displeased1']]
    }
  },

  // Bruno, the hammer: very polite, very large, remembers everything
  hammer: {
    bet: {
      short: [['Bit more.', 'sly1'], ['Lovely. Up it goes.', 'cocky1'], ['Your turn, son.', 'scheming1']],
      long:  [["I'm raising. Nothing personal. I just like the noise the chips make when they're mine.", 'gloating1'],
              ["Raise. I'd think very carefully, if I were you. I'd think about your car.", 'scheming1']]
    },
    call: {
      short: [['Go on, son.', 'sly1'], ["I'll see that.", 'neutral2'], ['Right.', 'suspicious1']],
      long:  [["I'll call. I remember everyone who makes me call.", 'scheming1'],
              ["I'll see it. My mum always said I should give people a chance.", 'smug1']]
    },
    fold: {
      short: [['Fine.', 'angry1'], ["You're lucky.", 'displeased1'], ['Enjoy it.', 'angry1']],
      long:  [["I'll let that one go. I don't let many things go.", 'angry1'],
              ["Take it. I'll remember where you're sitting.", 'displeased1']]
    }
  }
};
