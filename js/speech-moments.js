"use strict";

/* ============================================================
   SPEECH LAB — the moments (round 7, lab only)

   What they say when something actually happens to them, not just when
   they act:
   - lost:   they lose a big pot to you
   - beat:   they beat you in a big pot
   - bust:   you knock them out
   - streak: they've lost hand after hand

   The register, from three rounds of the owner reading drafts
   (2026-09-28):
   - No punchlines. No setup-and-twist, no second beat explaining the
     first. The funny or sad part is barely said; the player reads
     between the lines.
   - Vary the length: one word, one plain sentence, sometimes two.
   - Not everyone turns nasty. Mavis is innocent and kind; Steve
     apologises when he wins; Lucy is fair; Bruno is sometimes decent.
     Only Bruno carries any menace, and he never spells it out.
   - Swearing where people would actually swear. No slurs.

   A third element of 1 marks a line as one of the darker ones: the
   lab's DARK dial sets how often those come out. The LANGUAGE switch
   leaves out anything with a swear in it (SPEECH_SWEARS).

   Keyed by personality key, then moment. Faces are FACE_ART keys.
   ============================================================ */
const SPEECH_SWEARS = /\b(fuck\w*|shit\w*|bollocks|bastard\w*|twat\w*|prick\w*|wank\w*|bellend|cunt\w*|arse\w*|piss\w*|bloody)\b/i;

const SPEECH_MOMENTS = {
  // Nigel: petty, resentful, being picked up by his wife
  rock: {
    lost: [
      ["Right. Well. I'll just have a think about that.", 'displeased1'],
      ["You do know you weren't supposed to call that. Nobody calls that.", 'suspicious1'],
      ['Fine.', 'displeased1'],
      ["I'd like it noted that I played that correctly.", 'displeased1'],
      ["That was a lot of money for a Tuesday.", 'worried1'],
      ["I'm not going to make a scene.", 'angry1'],
      ['Brenda said this would happen.', 'worried1', 1],
      ['Every week. Every single week.', 'angry1', 1]
    ],
    beat: [
      ["I'm not going to say anything. I think it speaks for itself.", 'smug1'],
      ["There. Now you know how I've felt all evening.", 'smug1'],
      ['Thank you.', 'neutral2'],
      ["That's what happens when you're patient.", 'smug1'],
      ["I did say. Earlier. You weren't listening.", 'sly1'],
      ["I'll have to ring Brenda. She won't believe it.", 'happy1'],
      ["I've waited three weeks for that.", 'gloating1', 1],
      ["I'll be thinking about that in the car.", 'smug1', 1]
    ],
    bust: [
      ["I'll tell Brenda I broke even. She won't check.", 'worried1'],
      ["I'll wait in the car. Brenda's picking me up at eleven.", 'neutral3'],
      ["Right. Well. That's that.", 'displeased1'],
      ["I think I'll just go.", 'worried1'],
      ["I've no complaints. Well. I've one complaint.", 'displeased1'],
      ["It's half nine. She's not coming till eleven.", 'worried1', 1],
      ["I'll sit in the car with the radio on. It's fine.", 'neutral4', 1],
      ['Fucking hell.', 'angry1', 1]
    ],
    streak: [
      ["I've been here since six o'clock and I've won one hand. One.", 'displeased1'],
      ['Fucking hell, Nigel.', 'angry1'],
      ["This deck's not right. I'm not saying anything. It's not right.", 'suspicious1'],
      ["I should've stayed in.", 'worried1'],
      ["Something's going on.", 'suspicious2'],
      ["That's the car insurance, that.", 'worried1', 1],
      ["I'm not even enjoying it anymore. I don't think I ever was.", 'neutral4', 1],
      ["Brenda's going to ask how it went.", 'veryNervous1', 1]
    ]
  },

  // Lucy: composed, fair, very rarely cracks
  shark: {
    lost: [
      ['Okay.', 'neutral1'],
      ["That was a good call. I'd probably have made it too. Well done.", 'neutral2'],
      ['Hm. Noted.', 'suspicious1'],
      ['Fine. You earned that one.', 'neutral1'],
      ["I didn't think you'd do that.", 'suspicious2'],
      ["I'll remember that.", 'sly1'],
      ["That's the first pot I've lost all night.", 'displeased1', 1],
      ["Don't look at me. Please.", 'displeased1', 1]
    ],
    beat: [
      ['Sorry. Was that your rent?', 'sly1'],
      ["You played that fine. You just didn't have it.", 'neutral2'],
      ['Thanks.', 'neutral1'],
      ["You'll get the next one. Probably.", 'smug1'],
      ['I had it the whole way. Sorry.', 'smug1'],
      ["Don't take it personally.", 'neutral5'],
      ['You should go home. I mean that nicely.', 'sly1', 1],
      ['I do this for a living. Just so you know.', 'scheming1', 1]
    ],
    bust: [
      ["Right. Okay. I'm going to go and stand outside for a bit.", 'worried1'],
      ['Fuck.', 'shocked1'],
      ['Well played. Genuinely.', 'neutral1'],
      ["That's fine. That's absolutely fine.", 'nervous1'],
      ["I'll see you next week.", 'neutral2'],
      ["I don't lose. That's the thing. I don't.", 'shocked1', 1],
      ['I need to make a phone call.', 'veryNervous1', 1],
      ['Nobody say anything.', 'displeased1', 1]
    ],
    streak: [
      ["I'm fine. I'm just going to sit very still for a second.", 'nervous1'],
      ['Is anyone else finding it really warm in here?', 'nervous2'],
      ['Okay.', 'neutral1'],
      ['This happens. It happens to everyone.', 'worried1'],
      ['Can we just keep going.', 'displeased1'],
      ["I've stopped counting. That's a first.", 'veryNervous1', 1],
      ['My hands are doing a thing.', 'veryNervous2', 1],
      ['Deal. Just deal.', 'angry1', 1]
    ]
  },

  // Tony: skint, in denial, always about to turn it around
  maniac: {
    lost: [
      ["No, that's fine. That's fine. That was Kev's, but that's fine.", 'nervous1'],
      ["I'm in my overdraft now. Properly in it, not the fun bit.", 'worried1'],
      ['How though.', 'baffled1'],
      ["Unlucky. That's all that was. Unlucky.", 'displeased1'],
      ['Nah. Nah nah nah.', 'shocked1'],
      ['I had you. I had you till the end.', 'displeased1'],
      ["Kev's going to ask where it went.", 'veryNervous1', 1],
      ['That was the car. Well. That was the car payment.', 'nervous3', 1]
    ],
    beat: [
      ['Get in, you absolute weapon!', 'gloating1'],
      ["Sharon's getting a necklace. A real one this time.", 'joyful1'],
      ["Told you! Didn't I tell you?", 'cocky2'],
      ['Come on! Come on!', 'manic1'],
      ["That's the night paid for.", 'happy2'],
      ['Unlucky, mate. Honestly.', 'cocky1'],
      ["That's Kev sorted. Nearly.", 'relieved1', 1],
      ["Don't tell anyone how much that was.", 'sly1', 1]
    ],
    bust: [
      ["Can someone text Kev for me? Just say I'm on my way.", 'nervous1'],
      ['I literally need to win that back. Is there a cash machine round here?', 'veryNervous1'],
      ["No. No, that's not right.", 'shocked1'],
      ['Right. Anyone got a tenner?', 'happyConfused1'],
      ["I'll be back in twenty minutes. Don't give my seat away.", 'cocky1'],
      ['Does anyone want to buy a watch?', 'nervous2'],
      ["I'm going to go out the back way, if that's alright.", 'veryNervous2', 1],
      ["Sharon thinks I'm at the gym.", 'worried1', 1]
    ],
    streak: [
      ['It\'s turning. I can feel it. That last one was nearly good.', 'cocky1'],
      ["I've told Sharon I'm at the gym.", 'nervous1'],
      ["Next one. Next one's mine.", 'manic1'],
      ["I'm not even worried.", 'nervous3'],
      ["It all evens out. That's maths.", 'happyConfused1'],
      ["I've got a guy who can sort me out on Monday.", 'nervous2', 1],
      ['That was meant to be for the electric.', 'worried1', 1],
      ["I should ring Kev. I'm not going to ring Kev.", 'veryNervous1', 1]
    ]
  },

  // Mavis: innocent and kind; the sad part slips out without her noticing
  station: {
    lost: [
      ['Oh, well done you! No, honestly, you deserved that.', 'happy1'],
      ["Oh, never mind. It's only money, isn't it?", 'relieved1'],
      ["You've got lovely hands for cards. Has anyone ever told you that?", 'happy2'],
      ['Oh! I thought I had that. Silly me.', 'happyConfused1'],
      ["That's alright. I'm just happy to be here.", 'happy1'],
      ["Oh, you're good. You're really good.", 'joyful1'],
      ["That was the heating money. It's fine, it's nearly spring.", 'relieved1', 1],
      ["I'll just have soup this week. I like soup.", 'happy1', 1]
    ],
    beat: [
      ["Oh, I'm sorry. Do you want some of it back? I don't mind.", 'worried1'],
      ["Ooh! Is that all mine? I'll get us all a drink.", 'joyful1'],
      ['Oh my goodness. Oh my goodness!', 'ecstatic1'],
      ["I didn't know I had that. Honestly.", 'happyConfused1'],
      ['I feel a bit bad now.', 'worried1'],
      ['You played it really well, though.', 'happy2'],
      ["Nobody's ever let me win anything before.", 'joyful1', 1],
      ["I'm going to tell everyone at work. Well. There's one person.", 'happy1', 1]
    ],
    bust: [
      ["That's me done! Thank you, that was lovely.", 'happy1'],
      ["Don't tell my sister, will you. She thinks I'm at church.", 'worried1'],
      ['Oh well! It was nice while it lasted.', 'relieved1'],
      ["Can I still sit here and watch? I won't talk.", 'happy2'],
      ['Thank you for having me.', 'happy1'],
      ["It's the first time I've been out since March.", 'happy1', 1],
      ["I'll walk. It's not that far. It's quite far.", 'relieved1', 1],
      ["Same time next week? Oh. You're not coming next week.", 'worried1', 1]
    ],
    streak: [
      ["Still, it's nice to be out, isn't it?", 'happy1'],
      ["I'm learning such a lot.", 'happy2'],
      ['Oh dear. Oh well!', 'relieved1'],
      ["You're all so good at this.", 'joyful1'],
      ["I think my luck's about to turn. I've got a feeling.", 'happy1'],
      ["That's the Christmas money now. Oh well.", 'relieved1', 1],
      ["Everyone's been so nice to me tonight.", 'happy1', 1],
      ["I don't mind losing. I just like the company.", 'happy2', 1]
    ]
  },

  // Steve: tired, decent, apologetic; nights, the van, the kids
  grinder: {
    lost: [
      ['Course it did.', 'neutral3'],
      ["That's this week's shifts gone, that. Fair play.", 'neutral4'],
      ['You jammy weapon.', 'displeased1'],
      ['Yeah. Nice one.', 'neutral1'],
      ["Should've known. I did know. I called anyway.", 'neutral4'],
      ["That's about right for today.", 'neutral2'],
      ["That was the kids' money. For the weekend. It's fine.", 'worried1', 1],
      ["I'll do a double on Saturday.", 'neutral5', 1]
    ],
    beat: [
      ["Oh. Sorry, mate. I didn't think I'd actually have it.", 'worried1'],
      ['Might actually sleep indoors tonight.', 'relieved1'],
      ['Nice. Cheers.', 'neutral2'],
      ['Sorry about that.', 'neutral1'],
      ["Didn't expect that.", 'happyConfused1'],
      ['Finally.', 'relieved1'],
      ['I can take the kids somewhere now. Somewhere with a roof.', 'happy1', 1],
      ["Don't feel bad. I've been losing to you for weeks.", 'neutral2', 1]
    ],
    bust: [
      ["It's alright, the van's got a heater. Most nights.", 'neutral4'],
      ["I'm on at six anyway. Might as well head off.", 'neutral3'],
      ['Fair enough.', 'neutral1'],
      ['Good game, mate.', 'neutral2'],
      ["Right. That's me.", 'neutral4'],
      ["I'll tell the kids I won.", 'neutral5', 1],
      ["I'll just sit in the van for a bit.", 'worried1', 1],
      ['Shit. Right. Okay. Shit.', 'displeased1', 1]
    ],
    streak: [
      ['Been up since Tuesday. Is it still Wednesday?', 'confused1'],
      ['Shit.', 'displeased1'],
      ['Standard.', 'neutral4'],
      ['It\'ll turn. It usually turns.', 'neutral3'],
      ["I'm not even tired anymore. I'm past it.", 'neutral5'],
      ["That's the maintenance money.", 'worried1', 1],
      ["The ex'll love this.", 'neutral4', 1],
      ["I don't even like cards.", 'neutral3', 1]
    ]
  },

  // Roxy: bored, odd, unbothered, something going on at home
  wildcard: {
    lost: [
      ['Rude.', 'neutral4'],
      ['Cool. Cool cool cool. Cool.', 'neutral5'],
      ['Oh. Okay then.', 'neutral3'],
      ["I wasn't really trying.", 'sly1'],
      ["That's fine. I've got loads.", 'sly1'],
      ['Hm.', 'suspicious1'],
      ["That was my brother's. He won't mind. He's away.", 'neutral4', 1],
      ["I'm going to go and look at my phone for a bit.", 'neutral5', 1]
    ],
    beat: [
      ["I didn't even look at them. Genuinely.", 'sly1'],
      ['Ha. Your face just went.', 'manic1'],
      ['Oops.', 'scheming1'],
      ['Nice.', 'cocky2'],
      ["I don't know what I had. Was it good?", 'happyConfused1'],
      ["I'll buy something stupid with that.", 'manic1'],
      ["I'm going to keep that in my shoe.", 'scheming1', 1],
      ["That's the most I've won since the thing.", 'sly1', 1]
    ],
    bust: [
      ["I'm taking this pen.", 'sly1'],
      ['Fuck it. Same time Thursday?', 'neutral4'],
      ['Oh well.', 'neutral5'],
      ["That's me. Bye.", 'neutral3'],
      ['I was getting bored anyway.', 'neutral4'],
      ['Can I have a lift? No? Okay.', 'neutral5', 1],
      ["I'm going to go and sit on the wall outside.", 'neutral4', 1],
      ["Don't wait up.", 'sly1', 1]
    ],
    streak: [
      ["Is it hot in here or is it me? It's me, isn't it.", 'nervous1'],
      ["I've not eaten today. That's probably not related.", 'neutral4'],
      ['This is getting interesting.', 'sly1'],
      ["I'm not losing. I'm researching.", 'scheming1'],
      ['Someone should open a window.', 'neutral5'],
      ["My heart's going quite fast.", 'nervous2', 1],
      ["I've done this before. It ended okay. Ish.", 'neutral4', 1],
      ["Cool. I'm fine. This is fine.", 'veryNervous1', 1]
    ]
  },

  // Harry: pompous and fragile; the wife left
  professor: {
    lost: [
      ["That's not how that's supposed to work.", 'baffled1'],
      ["Statistically, you shouldn't have won that. I want that noted.", 'displeased1'],
      ['Fascinating.', 'suspicious2'],
      ["I made the correct decision. The cards didn't.", 'displeased1'],
      ["Well. That's unusual.", 'confused1'],
      ["I'll be reviewing that.", 'suspicious1'],
      ['That was my train fare, technically.', 'worried1', 1],
      ["My wife used to say I overthink things. She's not my wife anymore.", 'neutral4', 1]
    ],
    beat: [
      ["If you'd like, I can send you some reading on that spot.", 'smug1'],
      ['Q.E.D.', 'smug1'],
      ['As predicted.', 'cocky1'],
      ["You'll get there. Eventually.", 'smug1'],
      ['That was textbook. Not your textbook. A good one.', 'gloating1'],
      ["Don't be too hard on yourself. Well. Be a bit hard.", 'sly1'],
      ["I'd like to thank my training.", 'gloating1', 1],
      ["I'm going to write about this.", 'smug1', 1]
    ],
    bust: [
      ["No, I'll walk. It's only four miles. It's a nice evening.", 'neutral4'],
      ['Bollocks.', 'angry1'],
      ['Most irregular.', 'baffled1'],
      ["I'll accept that. Under protest.", 'displeased1'],
      ["I'll need to recalibrate.", 'confused1'],
      ['That was the last of the grant.', 'worried1', 1],
      ["I'll just go home. It's quiet at home now.", 'neutral3', 1],
      ['Absolute bollocks.', 'angry1', 1]
    ],
    streak: [
      ['The sample size is still very small.', 'confused1'],
      ['My wife would absolutely love this.', 'displeased1'],
      ["It's regression to the mean. It'll come.", 'nervous1'],
      ["I'm running some numbers.", 'nervous2'],
      ['Interesting.', 'suspicious2'],
      ["I've been sweating since the second hand.", 'veryNervous1', 1],
      ["I have a doctorate, you know. Not that it matters.", 'worried1', 1],
      ['Shit. Suboptimal. Shit.', 'angry1', 1]
    ]
  },

  // Bruno: quiet, polite, sometimes kind, sometimes not; never says it
  hammer: {
    lost: [
      ['Lovely.', 'neutral2'],
      ["What's your name, son? No reason.", 'suspicious1'],
      ["You've got nice teeth.", 'scheming1'],
      ['Well played, son.', 'neutral1'],
      ['Fair enough.', 'neutral2'],
      ["I'll remember that one.", 'sly1'],
      ['Where are you parked?', 'scheming1', 1],
      ["I'm going to have to explain that to someone.", 'displeased1', 1]
    ],
    beat: [
      ['Ta.', 'neutral1'],
      ["Don't worry about it, son. Happens to everyone.", 'neutral2'],
      ['Thank you.', 'smug1'],
      ["You'll be alright.", 'neutral1'],
      ['Good game.', 'neutral2'],
      ['Chin up.', 'smug1'],
      ['Go home, son. Get some sleep.', 'sly1', 1],
      ["Don't cry. Not here.", 'scheming1', 1]
    ],
    bust: [
      ['Fair enough. Finish your drink, no rush.', 'neutral2'],
      ["That was my mum's. She'll be alright.", 'neutral4'],
      ['Well played.', 'neutral1'],
      ['Right.', 'displeased1'],
      ["I'll see myself out.", 'neutral3'],
      ["I'll wait outside. Not for you. Just generally.", 'scheming1', 1],
      ["That's a lovely car you've got. The blue one.", 'sly1', 1],
      ["My mum's going to want to know who.", 'displeased1', 1]
    ],
    streak: [
      ["I'm staying very calm.", 'displeased1'],
      ['Could you deal the cards, please.', 'neutral2'],
      ['Hm.', 'suspicious1'],
      ["It's fine.", 'displeased1'],
      ['Interesting night.', 'neutral3'],
      ["I've done a course about this.", 'displeased1', 1],
      ["Everybody's fine. Nobody move.", 'angry1', 1],
      ['Please.', 'angry1', 1]
    ]
  }
};
