"use strict";

/* ============================================================
   SPEECH LAB — the lines (round 2, lab only)

   A working pass at the cast's voices, written for the Speech Lab so the
   bubbles have real lines to carry. Not the game's line bank: nothing in
   the game loads this file.

   The brief (owner, 2026-09-28): early top-down GTA mixed with Snatch and
   Sexy Beast, but not as syrupy as Guy Ritchie can get. "I don't want to
   roll my eyes." Round 1's "the numbers are delighted" and "writing it
   down in pen" were cut as too cute; "Bournemouth" landed.

   What the good stuff does, and the rules these follow:
   - People mean it. Nobody is being funny on purpose; the joke is the
     gap between how serious they are and what they're serious about.
   - Ordinary detail carries menace or pathos: a car, the bingo money, a
     shift at six. No conceits, no personified numbers, no wordplay.
   - Say less. Don Logan repeats himself; Brick Top never explains.
     Most lines are one breath.
   - Slang is rare and never a catchphrase. No "guv'nor", no "diamond".
   - It's a card table: people are rude, bored, proud, broke. Not
     writers.

   Keyed by personality key (03-opponents.js PERSONALITIES_ALL), then by
   what they just did: bet (bet, raise, all in), call (call, check) or
   fold; then short or long. Each line carries the face the speaker wears
   while saying it: a FACE_ART key from 02-support-systems.js.
   ============================================================ */
const SPEECH_LINES = {
  // Nigel, the rock: suburban, resentful, has been waiting all night for this
  rock: {
    bet: {
      short: [['Right. Now we talk.', 'smug1'], ["Don't.", 'suspicious1'], ["I've waited for this.", 'cocky1'],
              ["You'll want to fold that.", 'sly1'], ['Finally.', 'smug1']],
      long:  [["Two hours I've sat here. Two hours. So yes, I'm betting.", 'cocky1'],
              ["I don't bet unless I mean it. Everyone here knows that. Except you.", 'smug1']]
    },
    call: {
      short: [['Go on.', 'suspicious1'], ["I'll look.", 'neutral2'], ["I've seen you do that before.", 'suspicious2'],
              ['Mm.', 'suspicious2'], ['Show me.', 'displeased1']],
      long:  [["I'll call. I've watched you do that three times and I've not liked it once.", 'suspicious2'],
              ["Fine. But I want to see them. I'm not taking your word for it.", 'displeased1']]
    },
    fold: {
      short: [['No.', 'displeased1'], ['Not with this.', 'neutral3'], ['I was going to fold anyway.', 'neutral4'],
              ['Rubbish.', 'displeased1'], ["I'll wait.", 'neutral1']],
      long:  [["Fold. I'm not paying to watch you enjoy yourself.", 'displeased1'],
              ["No. I've got to drive home, and I'm not doing it skint.", 'neutral4']]
    }
  },

  // Lucy, the shark: cold, patient, never raises her voice
  shark: {
    bet: {
      short: [['Raise.', 'smug1'], ['Take your time.', 'sly1'], ['Your move.', 'scheming1'],
              ['Think about it.', 'scheming1'], ['Go on, then.', 'smug1']],
      long:  [["You've got a tell. I'm not going to tell you what it is.", 'scheming1'],
              ["Take your time. I've got all night. You've got about ten minutes.", 'sly1']]
    },
    call: {
      short: [['Fine.', 'neutral1'], ['Show me.', 'suspicious1'], ['Sure.', 'neutral5'],
              ["Let's see it.", 'sly1'], ['Mm-hm.', 'neutral1']],
      long:  [["I'll pay to see it. I like to know who I'm dealing with.", 'sly1'],
              ["Call. Show me what you think a good hand looks like.", 'suspicious2']]
    },
    fold: {
      short: [['Keep it.', 'neutral5'], ['Have it.', 'smug1'], ['Enjoy that.', 'sly1'],
              ['Borrow it.', 'scheming1'], ['Fine.', 'neutral1']],
      long:  [["Take it. I'll have it back before the blinds go up.", 'scheming1'],
              ["Have that one. You'll need it more than me.", 'smug1']]
    }
  },

  // Tony, the maniac: wide boy, owes somebody money, never regrets anything
  maniac: {
    bet: {
      short: [['Up.', 'cocky2'], ['Have some of that.', 'manic1'], ["Don't tell Sharon.", 'gloating1'],
              ['Double it. No, triple it.', 'manic1'], ['Come on then!', 'cocky1']],
      long:  [["Don't look at me like that. I've had worse cards and a better time.", 'cocky1'],
              ["That's rent money, that. Well. It was.", 'happyConfused1']]
    },
    call: {
      short: [['Yeah, go on.', 'sly1'], ["I'm in. Obviously.", 'cocky2'], ['Why not.', 'manic1'],
              ["I'm in, I'm in.", 'cocky1'], ['Go on, then!', 'happy2']],
      long:  [["I'm calling. I've already spent this pot, so technically it's mine.", 'happyConfused1'],
              ["I'll call. Put it on my tab. I've got a tab here, haven't I?", 'cocky1']]
    },
    fold: {
      short: [['Leave it out.', 'angry1'], ['Robbery.', 'displeased1'], ['Who shuffled that?', 'suspicious1'],
              ['Diabolical.', 'angry1'], ['Unbelievable.', 'displeased1']],
      long:  [["I'm folding under protest. I want that noted.", 'displeased1'],
              ["Who dealt these? I'm not saying anything. I'm asking who dealt these.", 'suspicious1']]
    }
  },

  // Mavis, the station: somebody's nan, calls everything, chats through it
  station: {
    bet: {
      short: [['Ooh. A bit more.', 'happy1'], ["Is that a raise? That's a raise.", 'confused1'], ["I'll have a flutter.", 'joyful1'],
              ['Go on, spoil me.', 'happy2'], ["I've got a good feeling.", 'joyful1']],
      long:  [['My Derek never raised in his life. Look where it got him. Bournemouth.', 'joyful1'],
              ["I'll put a bit on. It's only the bingo money, and the bingo's rubbish now.", 'happy2']]
    },
    call: {
      short: [['Oh, go on then.', 'happy1'], ["I'll see you, love.", 'happy2'], ['Just a little one.', 'relieved1'],
              ["I'll come along.", 'relieved1'], ['Why not, eh?', 'happyConfused1']],
      long:  [["I'll call, love. I don't know what I've got, but I've got it.", 'happyConfused1'],
              ["Go on then. My sister says I'm too trusting. She's a liar.", 'confused2']]
    },
    fold: {
      short: [['Ooh, no.', 'worried1'], ['Not for me, love.', 'relieved1'], ["I'll keep my pension, thanks.", 'worried1'],
              ["I'll sit this one out.", 'relieved1'], ['No, no, no.', 'worried1']],
      long:  [["I'm out. I only came for a sit down and a sherry.", 'relieved1'],
              ["Ooh, I'll leave it. Derek always said I was reckless. He's in Bournemouth.", 'confused2']]
    }
  },

  // Steve, the grinder: nights at the depot, tired, patient, practical
  grinder: {
    bet: {
      short: [['Small one.', 'neutral2'], ['Bit more.', 'sly1'], ['Same again.', 'neutral3'],
              ["It's only money.", 'neutral4'], ['Go on.', 'neutral1']],
      long:  [["I'm on nights all week. I've got time. Have you?", 'cocky1'],
              ["Small raise. I'm patient. You're not. That's the whole thing.", 'smug1']]
    },
    call: {
      short: [['Yeah, fine.', 'neutral3'], ['Worth a look.', 'neutral4'], ['Go on.', 'neutral1'],
              ['Yeah.', 'neutral5'], ['Alright.', 'neutral2']],
      long:  [["Calling. Don't make a thing of it, I'm on at six.", 'neutral5'],
              ["I'll call. Cheaper than the vending machine at work, and that's never paid out.", 'neutral4']]
    },
    fold: {
      short: [['Not worth it.', 'neutral3'], ['Fair enough.', 'neutral1'], ['Next.', 'neutral4'],
              ["I've got work in the morning.", 'neutral2'], ['Nah.', 'neutral5']],
      long:  [["I'm out. I'll wait for an actual hand.", 'displeased1'],
              ["Fold. I've waited for the night bus longer than I'll wait for you.", 'neutral2']]
    }
  },

  // Roxy, the wildcard: bored, sharp, in it for the chaos
  wildcard: {
    bet: {
      short: [['Bored. Raise.', 'sly1'], ['Oops.', 'scheming1'], ["Let's ruin someone's night.", 'manic1'],
              ['More.', 'cocky2'], ['Watch this.', 'manic1']],
      long:  [["I haven't looked at my cards. I have, actually. Doesn't matter.", 'scheming1'],
              ["Raise. Someone has to make this interesting and it won't be you.", 'cocky2']]
    },
    call: {
      short: [['Sure.', 'sly1'], ['Whatever.', 'neutral5'], ['Go on, surprise me.', 'happyConfused1'],
              ['Fine. Why not.', 'neutral4'], ['Yeah, alright.', 'sly1']],
      long:  [["I'm calling because it's more fun than not calling. That's my system.", 'happyConfused1'],
              ["Call. I want to see what you've been so pleased about.", 'suspicious1']]
    },
    fold: {
      short: [['Boring.', 'neutral4'], ['Nah.', 'neutral5'], ['Wake me up.', 'neutral3'],
              ["I've gone off it.", 'sly1'], ['Pass. Fold. Whatever.', 'neutral4']],
      long:  [['Fold. Wake me when somebody does something stupid.', 'neutral4'],
              ["I'm out. Not because of you. I just went off the idea.", 'sly1']]
    }
  },

  // Harry, the professor: pompous, precise, not as clever as he sounds
  professor: {
    bet: {
      short: [['Raise. Obviously.', 'smug1'], ['As expected.', 'smug1'], ['Correct raise.', 'cocky1'],
              ['I think not.', 'scheming1'], ['Textbook.', 'smug1']],
      long:  [["I don't expect you to understand this raise. That's rather the point.", 'smug1'],
              ["I've played this spot a thousand times. You've played it once. Now.", 'gloating1']]
    },
    call: {
      short: [['Acceptable.', 'suspicious2'], ["I'll humour you.", 'smug1'], ['Proceed.', 'neutral2'],
              ["Show me. I'm curious.", 'suspicious1'], ['Hm.', 'suspicious2']],
      long:  [["Calling. Not because I believe you. I just have questions.", 'suspicious1'],
              ["I'll call. I want to see how wrong you are, for my notes.", 'smug1']]
    },
    fold: {
      short: [['A correct fold.', 'smug1'], ['Withdrawn.', 'neutral1'], ['Noted.', 'displeased1'],
              ['Not profitable.', 'neutral2'], ['Fine. Correct, but fine.', 'displeased1']],
      long:  [["Folding. I'd explain why, but you'd only nod.", 'displeased1'],
              ["That's a fold. Anyone who's read anything would fold that.", 'smug1']]
    }
  },

  // Bruno, the hammer: very polite, very large, remembers everything
  hammer: {
    bet: {
      short: [['Bit more.', 'sly1'], ['Up it goes.', 'cocky1'], ['Go on. Call it.', 'scheming1'],
              ['Your turn, son.', 'scheming1'], ['Lovely.', 'smug1']],
      long:  [["I'd think very carefully, son. I'd think about your car.", 'scheming1'],
              ["Nothing personal. I just like it when the chips are mine.", 'gloating1']]
    },
    call: {
      short: [['Go on, son.', 'sly1'], ["I'll see that.", 'neutral2'], ['Right.', 'suspicious1'],
              ['Alright.', 'neutral1'], ["Let's have a look.", 'suspicious2']],
      long:  [["I'll call. I remember everyone who makes me call.", 'scheming1'],
              ["I'll see it. My mum always said give people a chance. Once.", 'smug1']]
    },
    fold: {
      short: [['Fine.', 'angry1'], ["You're lucky.", 'displeased1'], ['Enjoy it.', 'angry1'],
              ['Mind how you go.', 'displeased1'], ['Remember that.', 'angry1']],
      long:  [["I'll let that one go. I don't let many things go.", 'angry1'],
              ["Take it. I'll remember where you're sitting.", 'displeased1']]
    }
  }
};
