"use strict";

/* ============================================================
   P.I.P.'S LINES  (docs/coach/BRAIN_PLAN.md)

   The library his brain speaks from. The owner's brief: flat and plain,
   no nicknames, no catchphrases, no puns, clean. And (29 Sep 2026) PLAIN
   ENGLISH: advice, not a list of facts. Every line says what's happening,
   what it means for you, and what to do. A fact is only there if it
   helps you decide.

   POKER WORDS ARE LEARNED, NOT ASSUMED. A term is written {t:name}: it
   reads in plain words ("just calling the big blind") until the lesson
   that introduces it has been said ("That's called limping."), and from
   then on as the word itself ("limping"). TERMS below lists each term,
   its plain form and the lesson that teaches it. Seat names work the same
   way ({seatOn}, {seatFrom}: "one seat before the dealer button" until
   the position lesson, then "the cutoff").

   Each entry is [notch, mood, text]; {slots} are filled by coach-talk.js.
   The notch is the lowest talk-slider setting a line plays at (a judged
   line's notch comes from how sure he is). Keys:
     dealt.<band>.<seat group>   your cards, once you've seen them
     <tag>.now / .now.leans      a word right after you act
     <tag>.why / .why.leans      the reason, after the hand
     lesson.<lesson>             the first time a lesson comes up
     again.<lesson>              the same mistake again, soon after
     lead.<how>                  judge the decision, not the result
     advise.<kind>.<move>        before you act (the HELP dial)
     hint.<kind>                 HINTS: what to think about
     story.* / habit.*           what the others' betting says
     read.* / explain.*          tapping him
   Slots: {hole} {handWords} ("a strong starting hand") {rangeWords}
   ("about 1 hand in 4") {seatOn} {seatFrom} {SeatFrom} {raiserFrom}
   {behindP} {limpersP} {bb} {size} {to} {call} {pot} {odds} {eq} {need}
   {raiser} {bettor} {betSize} {handName} {drawName} {DrawName} {outs}
   {hitNext} {hitPct} {byWhen} {opp} {won} {sizeWords} {lean} {alt} {Lean}
   {Alt} {threat}
   ============================================================ */
const CoachLines = (() => {
  const L = {};
  const add = (key, notch, rows) => { L[key] = (L[key] || []).concat(rows.map(r => [notch, r[0], r[1]])); };

  /* Poker words: plain until taught. via = the lesson that teaches it. */
  const TERMS = {
    limp:        { plain:'just call the big blind',      term:'limp',             via:'raise-or-fold' },
    limping:     { plain:'just calling the big blind',   term:'limping',          via:'raise-or-fold' },
    limped:      { plain:'just called the big blind',    term:'limped',           via:'raise-or-fold' },
    aLimp:       { plain:'just calling',                 term:'a limp',           via:'raise-or-fold' },
    limpers:     { plain:'players who just called',      term:'limpers',          via:'raise-or-fold' },
    potOdds:     { plain:'the price',                    term:'the pot odds',     via:'pot-odds' },
    outs:        { plain:'cards that help you',          term:'outs',             via:'drawing-odds' },
    threeBet:    { plain:'a re-raise',                   term:'a three-bet',      via:'three-bet' },
    semiBluff:   { plain:'a bluff with a draw',          term:'a semi-bluff',     via:'semi-bluff' },
    valueBet:    { plain:'a bet to get paid by worse hands', term:'a value bet',  via:'value-betting' },
    kicker:      { plain:'your other card',              term:'your kicker',      via:'hand-strength' },
    shove:       { plain:'go all in',                    term:'shove',            via:'short-stack' },
    bluffCatcher:{ plain:'a hand that only beats a bluff', term:'a bluff catcher', via:'river-bets' },
    potControl:  { plain:'keeping the pot small',        term:'pot control',      via:'pot-control' },
    position:    { plain:'where you sit',                term:'your position',    via:'position' }
  };

  /* ================= your cards, once you've seen them ================= */
  add('dealt.premium.early', 4, [
    ['pleased', '{hole}. That’s {handWords}. Raise it, even from here.'],
    ['impressed', '{hole}. A hand to play properly. Raise.']]);
  add('dealt.premium.middle', 4, [
    ['pleased', '{hole}. That’s {handWords}. Raise it.'],
    ['impressed', '{hole}. A good one. Raise.']]);
  add('dealt.premium.late', 4, [
    ['impressed', '{hole}, and you act near the end. Strong cards and a good seat.'],
    ['pleased', '{hole}. A great hand in a good seat.']]);
  add('dealt.premium.blinds', 4, [
    ['pleased', '{hole}. That’s {handWords}. Don’t let it go cheaply.'],
    ['impressed', '{hole}. A strong hand, even from the blinds.']]);
  add('dealt.strong.early', 4, [
    ['calm', '{hole}. A good hand, but {behindP} still have to act after you. Careful.'],
    ['thinking', '{hole}. Good enough to play, even from here.']]);
  add('dealt.strong.middle', 4, [
    ['calm', '{hole}. A good hand. If nobody has raised yet, you should.'],
    ['pleased', '{hole}. That’s one to raise with.']]);
  add('dealt.strong.late', 4, [
    ['pleased', '{hole}, and you act near the end. Plenty good enough.'],
    ['calm', '{hole}. A good hand in a good seat.']]);
  add('dealt.strong.blinds', 4, [
    ['calm', '{hole}. Good, but after the flop you’ll have to act first. That makes it harder.'],
    ['thinking', '{hole}. A good hand in an awkward seat. Play it, carefully.']]);
  add('dealt.middle.early', 4, [
    ['thinking', '{hole}. Not strong enough when {behindP} still act after you. Usually a fold.'],
    ['calm', '{hole}. Tempting, but from this seat it’s usually a fold.']]);
  add('dealt.middle.middle', 4, [
    ['thinking', '{hole}. On the borderline from here. It depends what the others do first.'],
    ['calm', '{hole}. Could go either way from this seat.']]);
  add('dealt.middle.late', 4, [
    ['calm', '{hole}. Not much of a hand, but you act near the end, so you can raise it.'],
    ['pleased', '{hole}. Weak-ish, but a good seat to play it from.']]);
  add('dealt.middle.blinds', 4, [
    ['calm', '{hole}. Depends what it costs you.'],
    ['thinking', '{hole}. You’ve already paid part of it. Let’s see the price.']]);
  add('dealt.weak.early', 4, [
    ['calm', '{hole}. Fold this one.'], ['calm', '{hole}. A weak hand. Let it go.'], ['wince', '{hole}. Easy fold.']]);
  add('dealt.weak.middle', 4, [
    ['calm', '{hole}. Not worth playing. Fold.'], ['calm', '{hole}. Fold and wait for a better one.']]);
  add('dealt.weak.late', 4, [
    ['thinking', '{hole}. Weak, even from a good seat.'], ['calm', '{hole}. Most of the time, this is a fold.']]);
  add('dealt.weak.blinds', 4, [
    ['calm', '{hole}. If it’s free, check. If it costs anything, fold.'], ['wince', '{hole}. Not worth paying more for.']]);

  /* ================= before the flop: nobody in yet ================= */
  add('open.good.premium.now', 2, [['pleased', 'Good raise.'], ['pleased', 'Raised. That’s how to play it.'], ['impressed', 'Right. Make them pay to see the flop.']]);
  add('open.good.premium.why', 2, [
    ['pleased', 'Raising {hole} was right. When you have a great hand, you want more chips in the pot.'],
    ['calm', 'With {hole}, a raise does two jobs: some players fold, and the ones who call are usually behind you.']]);
  add('open.good.steal.now', 2, [['pleased', 'Good raise from there.'], ['calm', 'Nice. Using your seat.']]);
  add('open.good.steal.why', 2, [
    ['calm', '{hole} isn’t a strong hand, but only {behindP} could act after you. A raise often just wins the blinds.'],
    ['pleased', 'Raising {hole} {seatFrom} was right. Near the end, you can play more hands, because fewer players are left to beat you.']]);
  add('open.good.now', 4, [['calm', 'Raised. Good.'], ['calm', 'Good. First in, raise.']]);
  add('open.good.why', 4, [
    ['calm', 'Raising {hole} {seatFrom} was right. Good players raise about {rangeWords} from there, and this is one of them.'],
    ['calm', 'Nobody had come in, so a raise with {hole} was the right move.']]);
  add('open.loose.close.why', 4, [
    ['calm', 'Fine. {hole} is a borderline hand {seatFrom}: raising or folding are both OK.'],
    ['calm', 'Fine. From {seatFrom}, {hole} is right on the line between a raise and a fold.']]);
  add('open.loose.now', 1, [['wince', 'That hand’s too weak to raise from there.'], ['thinking', 'Too weak to play from that seat.']]);
  add('open.loose.now.leans', 3, [['thinking', 'A bit weak to play from there.'], ['thinking', 'That’s pushing it from that seat.']]);
  add('open.loose.why', 2, [
    ['thinking', '{hole} was too weak to raise {seatFrom}. {BehindP} still had to act after you, and the more players left, the more likely one of them has a better hand.'],
    ['calm', 'Good players only raise about {rangeWords} {seatFrom}. {hole} isn’t one of them. From the dealer button, it would be fine.']]);
  add('open.loose.why.leans', 2, [
    ['thinking', '{hole} {seatFrom} was a little too weak. Good players raise about {rangeWords} there, and this is just outside.'],
    ['calm', 'Not a big mistake, but fold {hole} from that seat next time.']]);
  add('open.big.now', 3, [['thinking', 'That’s a big raise.'], ['thinking', 'Bigger than it needs to be.']]);
  add('open.big.why', 2, [
    ['calm', 'You raised to {size} big blinds. Two and a half to three is enough. A huge raise only scares away the hands you want to beat.'],
    ['thinking', 'Right hand, too big a raise: {size} big blinds. A normal size keeps the weaker hands in.']]);
  add('open.shove.now', 1, [['surprised', 'All in? That’s a lot to risk.'], ['wince', 'That’s far too much.']]);
  add('open.shove.why', 2, [
    ['thinking', 'Going all in there risked {bb} big blinds just to win the blinds. A normal raise does the same job and risks far less.'],
    ['calm', 'When you go all in first, only better hands call you. Raise normally instead.']]);
  add('open.fold.strong.now', 1, [['surprised', 'You folded that?'], ['wince', 'That’s too good to fold.']]);
  add('open.fold.strong.now.leans', 3, [['thinking', 'I’d have raised that.'], ['thinking', 'That one was worth playing.']]);
  add('open.fold.strong.why', 2, [
    ['thinking', '{hole} is {handWords}. Nobody had raised, so that’s a raise, even from {seatFrom}.'],
    ['calm', 'You folded {hole}. Good players raise about {rangeWords} from there, and this was well inside that.']]);
  add('open.fold.strong.why.leans', 2, [
    ['thinking', '{hole} {seatFrom} was worth a raise. Folding is a small mistake. Being careful is good, but that was a bit too careful.']]);
  add('open.fold.close.why', 4, [['calm', 'Fine. {hole} {seatFrom} is borderline. Folding is OK.']]);
  add('open.fold.disciplined.now', 2, [['pleased', 'Good fold.'], ['calm', 'Good. Patience.']]);
  add('open.fold.disciplined.why', 2, [
    ['pleased', '{hole} looks playable, but {behindP} still had to act after you. Folding was right. You’ll get better chances.'],
    ['calm', 'Folding {hole} there was right. The earlier you act, the stronger your hand needs to be.']]);
  add('open.fold.good.why', 4, [['calm', 'Fine fold. {hole} isn’t worth playing.']]);

  /* ================= just calling the big blind ================= */
  add('limp.strong.now', 1, [['thinking', 'Just a call? Raise that.'], ['wince', 'That hand deserves a raise.']]);
  add('limp.strong.now.leans', 3, [['thinking', 'I’d raise that instead.'], ['thinking', 'A raise would be better.']]);
  add('limp.strong.why', 2, [
    ['thinking', 'You just called with {hole}. With a good hand, raise instead: more chips go in while you’re ahead, and fewer players stay in to beat you.'],
    ['calm', '{t:limping} with {hole} lets everyone in cheaply. Good hands want fewer opponents and a bigger pot. Raise them.']]);
  add('limp.strong.why.leans', 2, [
    ['thinking', '{hole} {seatFrom} was good enough to raise, not just call. When you’re first in, raise or fold.']]);
  add('limp.weak.now', 1, [['wince', 'Calling with that? Fold it.'], ['thinking', 'That’s a weak hand to pay for.']]);
  add('limp.weak.now.leans', 3, [['thinking', 'I’d have folded that.'], ['thinking', 'Raise or fold, usually.']]);
  add('limp.weak.why', 2, [
    ['thinking', 'You paid to play {hole}, a weak hand. Calling can’t win the pot straight away, and a weak hand usually loses later. Fold these.'],
    ['calm', '{t:limping} {hole} {seatFrom} costs you chips over time. Raise your good hands, fold the rest.']]);
  add('limp.weak.why.leans', 2, [
    ['calm', '{hole} was just below a raising hand from there. Fold it rather than just calling.']]);
  add('sb.complete.why', 4, [
    ['calm', 'Fine. Topping up the small blind with {hole} is cheap. Just remember you act first after the flop.']]);

  /* ================= players just called in front of you ================= */
  add('iso.good.now', 2, [['pleased', 'Good. Raise the ones who just called.'], ['calm', 'Good raise.']]);
  add('iso.good.why', 2, [
    ['calm', '{LimpersP} just called in front of you. Just calling usually means a weak hand, so raising {hole} was right. Often they fold, or you play against one weak hand.'],
    ['pleased', 'Raising {hole} after {t:limpers} was right. You take control of the pot with the better hand.']]);
  add('iso.loose.close.why', 4, [['calm', 'Fine. Raising {hole} after a call is borderline, but OK.']]);
  add('iso.loose.now', 1, [['thinking', 'That hand’s too weak to raise with.'], ['wince', 'Too loose.']]);
  add('iso.loose.now.leans', 3, [['thinking', 'A bit loose.']]);
  add('iso.loose.why', 2, [
    ['thinking', 'Raising {hole} after {limpersP} called was too loose. They sometimes call again, and then you’re in a bigger pot with a weak hand.']]);
  add('iso.loose.why.leans', 2, [['thinking', '{hole} was a little weak to raise with there. Keep that raise for better hands.']]);
  add('iso.limp.strong.now', 3, [['thinking', 'I’d raise that over them.'], ['thinking', 'That’s good enough to raise.']]);
  add('iso.limp.strong.why', 2, [
    ['thinking', '{LimpersP} just called and you called too, with {hole}. That hand is good enough to raise and take control.']]);
  add('iso.overlimp.why', 4, [['calm', 'Fine. Calling along with {hole} is cheap, and it’s a hand that can hit the flop hard.']]);
  add('iso.fold.strong.now', 3, [['thinking', 'That was worth a raise.']]);
  add('iso.fold.strong.why', 2, [
    ['thinking', 'Only {limpersP} had called in front of you. {hole} was strong enough to raise them. Players who just call usually have weak hands.']]);

  /* ================= the big blind ================= */
  add('bb.fold.free.now', 1, [['surprised', 'You could have checked for free.'], ['wince', 'That was free to check.']]);
  add('bb.fold.free.why', 2, [
    ['calm', 'You were in the big blind and nobody raised, so seeing the flop cost nothing. When it’s free, never fold.']]);
  add('bb.check.why', 4, [['calm', 'Checking in the big blind was right. A free look at the flop.']]);
  add('bb.check.strong.now', 3, [['thinking', 'You could raise that.']]);
  add('bb.check.strong.why', 2, [
    ['thinking', '{hole} in the big blind, with {limpersP} just calling. That’s a hand to raise. Make the weaker hands pay to see the flop.']]);
  add('bb.raise.good.now', 2, [['pleased', 'Good raise.']]);
  add('bb.raise.good.why', 2, [['pleased', 'Raising {hole} from the big blind was right. The players who just called are usually weaker than you.']]);
  add('bb.raise.loose.now', 3, [['thinking', 'You could have checked that for free.']]);
  add('bb.raise.loose.why', 2, [
    ['thinking', '{hole} is weak to raise with from the big blind. You had a free look at the flop, and you’ll have to act first for the rest of the hand.']]);
  add('bb.defend.good.now', 2, [['pleased', 'Good call.'], ['calm', 'Good. Defend it.']]);
  add('bb.defend.good.why', 2, [
    ['calm', 'Calling with {hole} in the big blind was right. You’d already put chips in, so the call was cheap: you needed to win {need}% of the time, and you win about {eq}%.'],
    ['pleased', 'Good. In the big blind you get a discount, so you can call a raise {raiserFrom} with more hands than anywhere else.']]);

  /* ================= facing a raise before the flop ================= */
  add('vsraise.fold.good.now', 2, [['pleased', 'Good fold.'], ['calm', 'Good. Let it go.']]);
  add('vsraise.fold.good.why', 2, [
    ['calm', 'When {raiser} raises, they usually have a good hand. {hole} only wins about {eq}% of the time against those. You’d need {need}%. Folding was right.'],
    ['pleased', 'Folding {hole} to a raise was right. Calling raises with hands that only look good is the most expensive habit in poker.']]);
  add('vsraise.fold.close.why', 4, [['calm', 'Fine. That fold was a close call. Calling would have been OK too.']]);
  add('vsraise.fold.priced.now', 1, [['surprised', 'That was worth a call.'], ['thinking', 'I’d have called that.']]);
  add('vsraise.fold.priced.now.leans', 3, [['thinking', 'I’d have called.']]);
  add('vsraise.fold.priced.why', 2, [
    ['thinking', 'You folded {hole}, but the price was good: you needed to win {need}% of the time, and against that raise you win about {eq}%. That’s a call.']]);
  add('vsraise.fold.priced.why.leans', 2, [['thinking', 'Folding {hole} there was a little too careful. About {eq}% against {need}% needed.']]);
  add('vsraise.fold.strong.now', 1, [['surprised', 'You folded that? That’s a strong hand.']]);
  add('vsraise.fold.strong.why', 2, [
    ['thinking', '{hole} wins about {eq}% against a raise like that. That’s a hand to raise again with, not fold.']]);
  add('vsraise.call.good.now', 4, [['calm', 'Good call.']]);
  add('vsraise.call.good.why', 2, [['calm', 'Calling {raiser}’s raise with {hole} was fine. You needed {need}%, and you win about {eq}%.']]);
  add('vsraise.call.close.why', 4, [['calm', 'Fine. That call was a close one. Folding would have been OK too.']]);
  add('vsraise.call.weak.now', 1, [['wince', 'That’s a weak hand to call a raise with.'], ['thinking', 'Calling a raise with that is expensive.']]);
  add('vsraise.call.weak.now.leans', 3, [['thinking', 'A loose call.'], ['thinking', 'I’d have folded.']]);
  add('vsraise.call.weak.why', 2, [
    ['thinking', 'You called {raiser}’s raise with {hole}. A raise usually means a good hand, and {hole} only wins about {eq}% against those. You needed {need}%. That’s a fold.'],
    ['calm', 'Calling raises with hands like {hole} is the most common leak there is. When you hit, they’ve often hit something better.'],
    ['thinking', 'A raise {raiserFrom} means a strong hand, about {rangeWords}. {hole} is behind most of those. Fold and wait.']]);
  add('vsraise.call.weak.why.leans', 2, [['thinking', 'Calling with {hole} was a bit loose: about {eq}%, and you needed {need}%.']]);
  add('vsraise.call.value.now', 3, [['thinking', 'You could raise again with that.']]);
  add('vsraise.call.value.why', 2, [
    ['thinking', 'Calling with {hole} is fine, but it’s strong enough to raise again. You were winning about {eq}% against their raise. Make them pay.'],
    ['calm', '{hole} against one raise: raise again. That’s called {t:threeBet}, and it builds the pot while you’re ahead.']]);
  add('vsraise.raise.value.now', 2, [['pleased', 'Good re-raise.'], ['pleased', 'Right. Raise it again.']]);
  add('vsraise.raise.value.why', 2, [
    ['pleased', 'Raising {raiser} again with {hole} was right. You win about {eq}% against their raise, so you want more chips in.']]);
  add('vsraise.raise.close.why', 4, [['calm', 'Fine. Raising again with {hole} was bold but reasonable.']]);
  add('vsraise.raise.loose.now', 1, [['surprised', 'Raising again with that?'], ['wince', 'That’s a lot to put in with that hand.']]);
  add('vsraise.raise.loose.why', 2, [
    ['thinking', 'You raised again with {hole}. Against a raise, it wins about {eq}%. If they call or raise back, you’re usually behind.'],
    ['calm', 'Keep the re-raise for strong hands. {hole} isn’t one against a raise.']]);

  /* ================= facing a re-raise ================= */
  add('vs3bet.fold.good.now', 2, [['pleased', 'Good fold.']]);
  add('vs3bet.fold.good.why', 2, [['calm', 'Two raises before the flop means a very strong hand. {hole} wins about {eq}% against that. Folding was right.']]);
  add('vs3bet.fold.close.why', 4, [['calm', 'Fine. Folding {hole} to the re-raise was a close call.']]);
  add('vs3bet.fold.priced.now', 3, [['thinking', 'I’d have called that.']]);
  add('vs3bet.fold.priced.why', 2, [['thinking', 'Folding {hole} to the re-raise was a bit too careful: you needed {need}% and had about {eq}%.']]);
  add('vs3bet.fold.strong.now', 1, [['surprised', 'You folded that?']]);
  add('vs3bet.fold.strong.why', 2, [['thinking', '{hole} still wins about {eq}% against a re-raise. That’s strong enough to keep going.']]);
  add('vs3bet.call.good.now', 4, [['calm', 'A fair call.']]);
  add('vs3bet.call.good.why', 4, [['calm', 'Calling the re-raise with {hole} was fine: about {eq}%, needing {need}%.']]);
  add('vs3bet.call.close.why', 4, [['calm', 'Fine. Calling the re-raise was a close call.']]);
  add('vs3bet.call.weak.now', 1, [['wince', 'Calling a re-raise with that is expensive.']]);
  add('vs3bet.call.weak.now.leans', 3, [['thinking', 'A loose call.']]);
  add('vs3bet.call.weak.why', 2, [['thinking', 'A re-raise means a very strong hand. {hole} only wins about {eq}% against those. You needed {need}%.']]);
  add('vs3bet.call.weak.why.leans', 2, [['thinking', 'Calling the re-raise with {hole} was a little loose.']]);
  add('vs3bet.call.value.now', 3, [['thinking', 'That was strong enough to raise again.']]);
  add('vs3bet.call.value.why', 2, [['calm', '{hole} was strong enough to raise again: about {eq}% even against a re-raise.']]);
  add('vs3bet.raise.value.now', 2, [['impressed', 'Raised again. Good.']]);
  add('vs3bet.raise.value.why', 2, [['pleased', 'Raising again with {hole} was right: about {eq}% even against a re-raise.']]);
  add('vs3bet.raise.close.why', 4, [['calm', 'Fine. Raising again was a close call.']]);
  add('vs3bet.raise.loose.now', 1, [['surprised', 'Raising again with that?']]);
  add('vs3bet.raise.loose.why', 2, [['thinking', 'Raising a re-raise with {hole} is too much. Against a hand that strong, it wins about {eq}%.']]);
  add('reraise.shove.big.now', 3, [['calm', 'Strong enough. A bit much, though.']]);
  add('reraise.shove.big.why', 2, [['calm', 'All in with {hole} works, but a normal re-raise keeps weaker hands in and wins you more.']]);
  add('reraise.shove.loose.now', 1, [['surprised', 'All in with that?']]);
  add('reraise.shove.loose.why', 2, [['thinking', 'All in with {hole} over a raise risks {bb} big blinds, and the hands that call you usually win. About {eq}%.']]);

  /* ================= short stacks ================= */
  add('short.push.good.now', 2, [['pleased', 'Good. All in.'], ['pleased', 'Right. When you’re short, all in is the play.']]);
  add('short.push.good.why', 2, [
    ['calm', 'With only {bb} big blinds, a small raise wastes chips you can’t spare. All in with {hole} was right: the others have to have a real hand to call.']]);
  add('short.push.close.why', 4, [['calm', 'Fine. All in with {hole} on {bb} big blinds was a close call.']]);
  add('short.push.loose.now', 1, [['wince', 'All in with that is too loose.']]);
  add('short.push.loose.now.leans', 3, [['thinking', 'A bit loose to go all in.']]);
  add('short.push.loose.why', 2, [
    ['thinking', 'With {bb} big blinds {seatFrom}, good players go all in with about {rangeWords}. {hole} was too weak: too many players after you could have a better hand.']]);
  add('short.push.loose.why.leans', 2, [['thinking', 'All in with {hole} there was a little loose.']]);
  add('short.fold.missed.now', 1, [['thinking', 'You’re short. That was an all in.'], ['surprised', 'That was good enough to go all in.']]);
  add('short.fold.missed.now.leans', 3, [['thinking', 'I’d have gone all in with that.']]);
  add('short.fold.missed.why', 2, [
    ['thinking', 'With {bb} big blinds, you can’t wait for a perfect hand: the blinds keep eating your stack. {hole} {seatFrom} was an all in.']]);
  add('short.fold.missed.why.leans', 2, [['thinking', 'Folding {hole} on {bb} big blinds was a bit too careful. That’s an all in from there.']]);
  add('short.fold.close.why', 4, [['calm', 'Fine. Folding {hole} while short was a close call.']]);
  add('short.fold.good.why', 4, [['calm', 'Folding {hole} while short was right. Wait for a better hand to go all in with.']]);
  add('short.raise.small.now', 3, [['thinking', 'When you’re that short, just go all in.']]);
  add('short.raise.small.why', 2, [['calm', 'With {bb} big blinds, a normal raise uses up most of your chips anyway. All in makes them fold more often.']]);
  add('short.limp.now', 1, [['wince', 'When you’re short, all in or fold.']]);
  add('short.limp.why', 2, [['calm', 'With {bb} big blinds, just calling wastes chips you can’t spare. All in with good hands, fold the rest.']]);
  add('short.flat.now', 3, [['thinking', 'When you’re short, go all in instead.']]);
  add('short.flat.why', 2, [['calm', 'Short-stacked, calling a raise leaves you too little to play with. {hole} wins about {eq}% here: all in instead.']]);
  add('short.reshove.good.now', 2, [['pleased', 'Good. All in.']]);
  add('short.reshove.good.why', 2, [['calm', 'All in over the raise with {hole} and {bb} big blinds was right. You win about {eq}% if they call, and sometimes they fold.']]);

  /* ================= after the flop, facing a bet ================= */
  add('post.fold.strong.now', 1, [['surprised', 'You folded that? You were well ahead.'], ['wince', 'That was too good to fold.']]);
  add('post.fold.strong.why', 2, [
    ['thinking', 'You folded {handName}. Against the hands {bettor} bets like that, you were winning about {eq}% of the time. That’s at least a call.'],
    ['calm', '{handName} was a strong hand. One bet isn’t enough reason to give it up: people bet with worse hands too.']]);
  add('post.fold.good.now', 2, [['pleased', 'Good fold.'], ['calm', 'Right. Let it go.']]);
  add('post.fold.good.why', 2, [
    ['calm', 'Folding {handName} was right. That bet usually means a better hand, and you only win about {eq}% against those. You needed {need}%.'],
    ['pleased', 'A good fold. {handName} looked decent, but {bettor}’s bet said otherwise most of the time.']]);
  add('post.fold.close.why', 4, [['calm', 'Fine. That fold was a close call.']]);
  add('post.fold.draw.now', 1, [['thinking', 'That draw was cheap enough to chase.']]);
  add('post.fold.draw.now.leans', 3, [['thinking', 'I’d have called with that draw.']]);
  add('post.fold.draw.why', 2, [
    ['thinking', 'You folded {drawName}. The bet was cheap enough: counting the cards to come, you’d win about {eq}% of the time, and you only needed {need}%.'],
    ['calm', 'That draw was worth chasing. {outs} cards would have made your hand, and the bet was small for the pot.']]);
  add('post.fold.draw.why.leans', 2, [['thinking', 'Folding {drawName} was a little too careful.']]);
  add('post.fold.priced.now', 1, [['thinking', 'That was worth a call.']]);
  add('post.fold.priced.now.leans', 3, [['thinking', 'I’d have called that.']]);
  add('post.fold.priced.why', 2, [
    ['thinking', 'You folded {handName} for {call}. You needed to win {need}% of the time, and you win about {eq}% against the hands {bettor} bets like that. Call next time.']]);
  add('post.fold.priced.why.leans', 2, [['thinking', 'Folding {handName} there was a bit too careful.']]);
  add('post.call.value.now', 3, [['thinking', 'You could raise that.']]);
  add('post.call.value.why', 2, [
    ['thinking', 'Calling with {handName} is fine, but it’s strong enough to raise. You were winning about {eq}% of the time. Make them pay.']]);
  add('post.call.good.now', 4, [['calm', 'Good call.']]);
  add('post.call.good.why', 2, [
    ['calm', 'Calling with {handName} was right. A bet doesn’t always mean a monster, and you win about {eq}% against {bettor}’s likely hands.'],
    ['pleased', 'Good call. It was {betSize}, and {handName} wins often enough to pay for it.']]);
  add('post.call.draw.good.now', 2, [['pleased', 'Good call with the draw.']]);
  add('post.call.draw.good.why', 2, [
    ['calm', 'Calling with {drawName} was right. {outs} cards make your hand, and the bet was cheap enough to chase it.']]);
  add('post.call.close.why', 4, [['calm', 'Fine. That call was a close one.']]);
  add('post.call.draw.bad.now', 1, [['wince', 'That’s too expensive to chase.']]);
  add('post.call.draw.bad.now.leans', 3, [['thinking', 'A bit expensive for that draw.']]);
  add('post.call.draw.bad.why', 2, [
    ['thinking', 'You chased {drawName} for {call}. The next card only makes your hand about {hitNext}% of the time, and the bet needed you to win {odds}%. Too expensive.'],
    ['calm', 'Chasing a draw only pays when the bet is small. {betSize} is too big for {drawName}.']]);
  add('post.call.draw.bad.why.leans', 2, [['thinking', 'Calling with {drawName} was slightly too expensive.']]);
  add('post.call.weak.now', 1, [['wince', 'That’s a weak hand to call with.']]);
  add('post.call.weak.now.leans', 3, [['thinking', 'A loose call.']]);
  add('post.call.weak.why', 2, [
    ['thinking', 'You called {betSize} with {handName}. That bet usually means a better hand: you win about {eq}% against those, and you needed {need}%. That’s a fold.'],
    ['calm', 'Calling because your hand “might be good” is one of the biggest leaks there is. When someone bets, fold the weak ones.']]);
  add('post.call.weak.why.leans', 2, [['thinking', 'That call with {handName} was a little loose.']]);
  add('post.raise.value.now', 2, [['pleased', 'Good raise.'], ['pleased', 'Right. Make them pay.']]);
  add('post.raise.value.why', 2, [['pleased', 'Raising with {handName} was right. You were winning about {eq}% of the time, so you want more chips in.']]);
  add('post.raise.protect.why', 4, [['calm', 'Fine. Raising {handName} is OK, but calling is usually better: mostly better hands call a raise.']]);
  add('post.raise.semi.now', 3, [['thinking', 'Raising with a draw. Bold.']]);
  add('post.raise.semi.why', 2, [['calm', 'Raising with {drawName} is {t:semiBluff}: they might fold now, and if not, you can still make your hand. Fine against one player.']]);
  add('post.raise.close.why', 4, [['calm', 'Fine. That raise was reasonable.']]);
  add('post.raise.loose.now', 1, [['surprised', 'Raising with that?']]);
  add('post.raise.loose.why', 2, [['thinking', 'You raised with {handName}. If they call or raise back, you’re usually behind. Keep raises for strong hands, or strong draws.']]);

  /* ================= checked to you: bet or check ================= */
  add('bet.missed.now', 3, [['thinking', 'You could have bet that.'], ['thinking', 'That hand was worth a bet.']]);
  add('bet.missed.why', 2, [
    ['thinking', 'You checked {handName}. That was strong: you’d win about {eq}% of the time. When nobody bets and you’re that far ahead, bet so the weaker hands pay you.'],
    ['calm', 'With {handName}, a bet of about {sizeWords} would have won more. Worse hands often call.']]);
  add('bet.value.now', 2, [['pleased', 'Good bet.'], ['pleased', 'Right. Make them pay.']]);
  add('bet.value.why', 2, [
    ['pleased', 'Betting {handName} was right. You were well ahead, so a bet gets money from the weaker hands. That’s called {t:valueBet}.'],
    ['calm', 'Good bet with {handName}. Strong hands should bet, not wait.']]);
  add('bet.value.small.now', 3, [['thinking', 'Good, but you could bet more.']]);
  add('bet.value.small.why', 2, [['calm', 'Betting {handName} was right, but the bet was small. About {sizeWords} gets more from the hands that call.']]);
  add('bet.check.medium.why', 4, [['calm', 'Checking {handName} was fine. A middling hand wants a cheap showdown, not a big pot.']]);
  add('bet.thin.why', 4, [['calm', 'Fine. Betting {handName} is OK, but a middling hand usually does better checking.']]);
  add('bet.semi.now', 2, [['pleased', 'Good. Bet the draw.']]);
  add('bet.semi.why', 2, [
    ['calm', 'Betting {drawName} was good. You win two ways: they fold now, or you make your hand later. That’s {t:semiBluff}.']]);
  add('bet.semi.multi.why', 4, [['calm', 'Betting a draw into several players is OK, but one of them usually calls.']]);
  add('bet.check.draw.why', 4, [['calm', 'Checking {drawName} was fine. Against one player, a bet could have won it straight away.']]);
  add('bet.bluff.good.now', 2, [['pleased', 'Good bluff.'], ['impressed', 'Nicely done.']]);
  add('bet.bluff.good.why', 2, [
    ['calm', 'Bluffing there made sense: one player, and they’d shown weakness by checking. A bet that size needs them to fold {foldNeed}% of the time, and players in that spot fold about {fold}%.'],
    ['pleased', 'A good bluff. You picked one player who wasn’t showing strength.']]);
  add('bet.bluff.close.why', 4, [['calm', 'Fine. That bluff was a close call. It works sometimes.']]);
  add('bet.bluff.bad.now', 3, [['thinking', 'That bluff was risky.']]);
  add('bet.bluff.bad.why', 2, [
    ['thinking', 'That bluff needed them to fold {foldNeed}% of the time. In that spot, they fold nearer {fold}%. Save bluffs for when they look weaker.']]);
  add('bet.bluff.multi.now', 1, [['wince', 'Bluffing into several players rarely works.']]);
  add('bet.bluff.multi.why', 2, [
    ['thinking', 'You bet {handName} into {players} players. For a bluff to work, every one of them has to fold. Bluff one player, not several.']]);
  add('bet.bluff.station.now', 3, [['thinking', 'They call a lot. Careful bluffing them.']]);
  add('bet.bluff.station.why', 2, [['calm', 'That player hardly ever folds to a bet. Don’t bluff them. Bet your good hands bigger instead.']]);
  add('bet.bluff.chance.now', 4, [['thinking', 'A bet might have taken that.']]);
  add('bet.bluff.chance.why', 2, [
    ['calm', 'Checking was fine, but a bet might have won it. {Opp} had only checked, and one weak player folds to a bet quite often. That’s a good spot to bluff.'],
    ['thinking', 'You had nothing, but so did they, most likely: they’d only checked. A bet of {sizeWords} would often win the pot straight away.']]);
  add('bet.check.weak.why', 4, [['calm', 'Checking nothing was fine.']]);

  /* ================= what their betting says ================= */
  add('story.weak.one', 3, [['thinking', '{Opp} has only checked. That usually means a weak hand.'], ['calm', '{Opp} hasn’t bet at all. They’re probably not strong.']]);
  add('story.weak.all', 3, [['thinking', 'They’ve all checked. Nobody’s shown any strength.'], ['calm', 'Nobody has bet. That usually means nobody has much.']]);
  // (the story follows the hand: one bet is a bet, "keeps" only after two,
  // and a quiet player who suddenly bets gets its own line)
  add('story.strong.one', 3, [['thinking', '{Opp} bet. That often means a real hand, so be careful with a weak one.']]);
  add('story.strong.again.one', 3, [['thinking', '{Opp} has bet more than once now. That usually means a real hand.'], ['calm', '{Opp} keeps betting. Take that seriously.']]);
  add('story.turned.one', 3, [
    ['thinking', '{Opp} was quiet before, and bets now. They may have just hit something, or they may be trying to take the pot. A good hand can still call.'],
    ['calm', '{Opp} has only just started betting. Either that card helped them, or they think you’re weak. Don’t fold a good hand to one bet.']]);
  add('story.turned.all', 3, [['thinking', 'Someone quiet has just started betting. They may have hit that card. Be careful, but don’t panic.']]);
  add('story.strong.all', 3, [['thinking', 'They’ve been betting. Someone likes their hand.']]);
  add('story.calling.one', 3, [['thinking', '{Opp} called. That usually means a middling hand or a draw.']]);
  add('story.calling.again.one', 3, [['thinking', '{Opp} keeps calling. That usually means a middling hand or a draw.']]);
  add('story.calling.all', 3, [['thinking', 'They’re calling, not raising. Middling hands and draws, mostly.']]);
  add('story.mixed', 3, [['thinking', 'One of them is betting and the others are just following. The bettor is the one to worry about.']]);
  add('habit.caller', 3, [['calm', '{Opp} hardly ever folds, so don’t bluff them. Bet your good hands bigger.']]);
  add('habit.bluffer', 3, [['thinking', '{Opp} has been caught bluffing before. Their bets aren’t always real.']]);
  add('habit.loose', 3, [['calm', '{Opp} plays a lot of hands, so they often have less than it looks.']]);
  add('habit.tight', 3, [['thinking', '{Opp} only plays good hands. Respect their bets.']]);

  /* ================= lessons: when one first comes up ================= */
  add('lesson.starting-hands', 2, [
    ['calm', 'Most starting hands aren’t worth playing. Good players play about one hand in five. Patience wins.'],
    ['calm', 'The hands worth playing: pairs, two high cards, and cards of the same suit next to each other.']]);
  add('lesson.position', 2, [
    ['calm', 'Where you sit matters. The later you act, the more you’ve seen before you decide. The seat just before the dealer button is called the cutoff; the first to act is called under the gun.'],
    ['calm', 'Acting last is an advantage: you see what everyone else does first. That’s called position. Play more hands when you act late, fewer when you act early.']]);
  add('lesson.raise-or-fold', 2, [
    ['calm', 'When nobody has raised yet, raise or fold. Just calling the big blind is called limping. A raise can win the pot straight away; a call never can.']]);
  add('lesson.calling-raises', 2, [
    ['calm', 'A raise usually means a good hand. Before you call one, ask: does my hand beat the hands this player raises with? Usually, the answer is no.']]);
  add('lesson.bb-defence', 2, [
    ['calm', 'In the big blind, you’ve already put chips in, so calling a raise costs less. You can play more hands there than anywhere else, but not everything.']]);
  add('lesson.short-stack', 2, [
    ['calm', 'When you have about ten big blinds or fewer, stop making small raises. Go all in or fold. Going all in like that is called a shove.']]);
  add('lesson.three-bet', 2, [
    ['calm', 'Raising after someone else has raised is called a three-bet. With a strong hand, it builds the pot while you’re ahead.']]);
  add('lesson.the-basics', 2, [
    ['calm', 'The big blind is a forced bet. If nobody raises, you can check and see the flop for free. Never fold when it’s free.']]);
  add('lesson.pot-odds', 2, [
    ['calm', 'Every call has a price. If it costs 25 to win 75, you need to win one time in four to break even: 25%. That’s called the pot odds.'],
    ['calm', 'When someone bets, ask two things: what does a bet like that usually mean, and does my hand win often enough to pay for it?']]);
  add('lesson.drawing-odds', 2, [
    ['calm', 'When you’re waiting for a card, count the cards that would make your hand. Those are called outs. A flush draw has 9. Each card to come gives you about 2% per out.'],
    ['calm', 'Chasing a draw is only worth it when the bet is small. Big bets, usually fold.']]);
  add('lesson.river-bets', 2, [
    ['calm', 'Big bets on the last card are rarely bluffs, especially from quiet players. A hand that can only beat a bluff is called a bluff catcher. Careful calling with one.']]);
  add('lesson.hand-strength', 2, [
    ['calm', 'How strong a hand is depends on the board. A pair of kings is great on a quiet board, and weak when four cards of one suit are showing.'],
    ['calm', 'With a pair, your other card matters too. It’s called your kicker: if you both have the same pair, the higher kicker wins.']]);
  add('lesson.raising-for-value', 2, [
    ['calm', 'When someone bets and you’re well ahead, raise. Two pair or better, usually. With one pair, calling is usually better: a raise mostly gets called by better hands.']]);
  add('lesson.value-betting', 2, [
    ['calm', 'When your hand is strong and nobody bets, you bet. The point is to get paid by weaker hands. That’s called a value bet. Checking a strong hand lets them off for free.']]);
  add('lesson.pot-control', 2, [
    ['calm', 'With a middling hand, keep the pot small. Check, and call small bets. Big pots are for big hands. That’s called pot control.']]);
  add('lesson.bluffing', 2, [
    ['calm', 'A bluff is a bet with a weak hand, to make a better hand fold. Bluff one player who has shown weakness by checking. Never bluff someone who calls everything.'],
    ['calm', 'Bluff the same size you’d bet a good hand, so your bet doesn’t give you away. And don’t bluff often: a few well-chosen ones are enough.']]);
  add('lesson.semi-bluff', 2, [
    ['calm', 'Betting with a draw is called a semi-bluff. You win two ways: they fold now, or you make your hand later. It works best against one player.']]);

  /* ================= again: the same thing, not long after ================= */
  add('again.raise-or-fold', 3, [['thinking', 'Another call. Raise or fold.'], ['calm', 'Same as before: raise it or let it go.']]);
  add('again.position', 3, [['thinking', 'Again: too weak for that seat.'], ['calm', 'Remember your seat. Early means tight.']]);
  add('again.starting-hands', 3, [['thinking', 'Another good hand folded.']]);
  add('again.calling-raises', 3, [['thinking', 'Another call against a raise with a weak hand.'], ['calm', 'Same again: a raise means strength.']]);
  add('again.bb-defence', 3, [['calm', 'Same as last time: the big blind gets a discount.']]);
  add('again.short-stack', 3, [['thinking', 'Short again. All in or fold.']]);
  add('again.three-bet', 3, [['thinking', 'Careful with those re-raises.']]);
  add('again.the-basics', 3, [['thinking', 'It was free again. Just check.']]);
  add('again.pot-odds', 3, [['thinking', 'Same again: check the price.']]);
  add('again.drawing-odds', 3, [['thinking', 'Another expensive chase.']]);
  add('again.river-bets', 3, [['thinking', 'Careful with big bets on the last card.']]);
  add('again.hand-strength', 3, [['thinking', 'Another good hand given up.']]);
  add('again.raising-for-value', 3, [['thinking', 'That’s another one to raise.']]);
  add('again.value-betting', 3, [['thinking', 'Another strong hand checked. Bet those.'], ['calm', 'Same again: when you’re strong, bet.']]);
  add('again.pot-control', 3, [['calm', 'Same again: middling hands, small pots.']]);
  add('again.bluffing', 3, [['thinking', 'Careful with the bluffs.'], ['calm', 'Same again: bluff one player, not several.']]);
  add('again.semi-bluff', 3, [['thinking', 'Another draw. Bet it against one player.']]);

  /* ================= lead-ins: the decision, not the result ================= */
  add('lead.wonAnyway', 2, [['thinking', 'You won it, but that’s not the point.'], ['calm', 'You got lucky there.'], ['thinking', 'It worked this time.']]);
  add('lead.lostAnyway', 2, [['unlucky', 'You lost, but you played it right.'], ['unlucky', 'Unlucky. The decision was right.']]);
  add('lead.wonButMore', 2, [['calm', 'You won {won}, but you could have won more.'], ['calm', 'A win. It could have been a bigger one.']]);

  /* ================= advice before you act ================= */
  add('advise.open.raise', 3, [
    ['calm', 'Raise this. {hole} is {handWords}, good enough from here. Make it {to}.'],
    ['pleased', 'Nobody’s in. {hole} is good enough {seatFrom}: raise to {to}.'],
    ['calm', 'First in with {hole}. Raise to about {to}. Don’t just call.']]);
  add('advise.open.fold', 3, [
    ['calm', 'Fold this. {hole} isn’t strong enough with {behindP} still to act after you.'],
    ['thinking', 'I’d fold. {hole} isn’t good enough {seatFrom}.']]);
  add('advise.open.allin', 3, [['calm', 'You’re short. {hole} is good enough: go all in.']]);
  add('advise.limped.raise', 3, [
    ['calm', '{LimpersP} just called. Raise them with {hole}. Make it {to}.'],
    ['pleased', 'Just calling usually means a weak hand. {hole} is a raise: about {to}.']]);
  add('advise.limped.call', 3, [['calm', 'You can call along here. {hole} is cheap to play, and it can hit the flop hard.']]);
  add('advise.limped.fold', 3, [['calm', 'Fold. {hole} isn’t worth playing, even this cheaply.']]);
  add('advise.limped.allin', 3, [['calm', 'You’re short, and {hole} is good enough: all in.']]);
  add('advise.bbOption.check', 3, [['calm', 'Check. It’s free.'], ['calm', 'Just check and see the flop for nothing.']]);
  add('advise.bbOption.raise', 3, [['pleased', 'Raise. {hole} is strong, and the others just called. Make it {to}.']]);
  add('advise.bbOption.allin', 3, [['calm', 'You’re short and {hole} is strong. All in.']]);
  add('advise.vsRaise.fold', 3, [
    ['calm', 'Fold. {raiser}’s raise usually means a good hand, and {hole} only wins about {eq}% against those. You’d need {need}%.'],
    ['thinking', '{raiser} raised. {hole} is behind most of the hands that means. Fold it.']]);
  add('advise.vsRaise.call', 3, [
    ['calm', 'Call. {hole} wins about {eq}% against that raise, and you only need {need}%.'],
    ['calm', 'The price is right. Call with {hole}.']]);
  add('advise.vsRaise.raise', 3, [
    ['pleased', 'Raise again. {hole} wins about {eq}% against their raise. Make it {to}.']]);
  add('advise.vsRaise.allin', 3, [['calm', 'You’re short. {hole} wins about {eq}% here: all in.']]);
  add('advise.vsReraise.fold', 3, [['calm', 'Fold. Two raises means a very strong hand, and {hole} wins about {eq}% against that.']]);
  add('advise.vsReraise.call', 3, [['calm', 'Call. {hole} holds up well enough: about {eq}%, needing {need}%.']]);
  add('advise.vsReraise.raise', 3, [['pleased', 'Raise again. {hole} wins about {eq}% even against a re-raise.']]);
  add('advise.vsReraise.allin', 3, [['calm', 'All in. {hole} is strong enough, about {eq}%, and you’re short.']]);
  add('advise.short.allin', 3, [
    ['calm', 'You have {bb} big blinds. All in with {hole}.'],
    ['calm', 'Short stack, first in: all in with {hole}.']]);
  add('advise.short.fold', 3, [['calm', 'Fold. With {bb} big blinds it’s all in or fold, and {hole} is a fold from here.']]);
  add('advise.post.fold', 3, [
    ['calm', 'Fold. That bet usually means a better hand. {handName} only wins about {eq}% against those, and you’d need {need}%.'],
    ['thinking', '{Bettor} made {betSize}. {handName} isn’t good enough. Fold it.']]);
  add('advise.post.call', 3, [
    ['calm', 'Call. You win about {eq}% against the hands that bet like that, and you only need {need}%.'],
    ['calm', 'The price is right. Call with {handName}.']]);
  add('advise.post.raise', 3, [['pleased', 'Raise. {handName} is strong: you win about {eq}% of the time. Make it {to}.']]);
  add('advise.post.allin', 3, [['calm', 'All in. {handName} is strong enough, about {eq}%.']]);
  add('advise.post.call.draw', 3, [
    ['calm', 'Call. {DrawName}: {outs} cards make your hand, and the bet is cheap enough to chase it.']]);
  add('advise.post.fold.draw', 3, [
    ['calm', 'Fold. {DrawName} only comes in about {hitNext}% of the time on the next card, and the bet needs {odds}%. Too expensive.']]);
  add('advise.bet.bet', 3, [
    ['pleased', 'Bet. {handName} is strong and they’re not. Bet about {to} and make them pay.'],
    ['calm', 'You’re well ahead. Bet about {to}. Worse hands will call.']]);
  add('advise.bet.bet.draw', 3, [['calm', 'Bet {drawName}. Against one player, you win if they fold now, or if you make your hand later. About {to}.']]);
  add('advise.bet.bet.bluff', 3, [
    ['thinking', 'You’ve got nothing, but they look weak too. A bet of about {to} will often win this straight away.'],
    ['calm', 'This is a spot to bluff: one player, and they’ve only checked. Bet about {to}.']]);
  add('advise.bet.check', 3, [
    ['calm', 'Check. {handName} is a middling hand. Keep the pot small.'],
    ['calm', 'Just check. A bet here mostly gets called by better hands.']]);
  add('advise.bet.check.weak', 3, [
    ['calm', 'Check. You’ve got nothing, and bluffing here won’t work often enough.'],
    ['thinking', 'Check and see. Not a good spot to bluff.']]);
  add('advise.bet.check.multi', 3, [['calm', 'Check. Too many players to bluff. One of them will call.']]);
  add('advise.close', 3, [
    ['thinking', 'It’s close. I’d {lean}, but {alt} is fine too.'],
    ['calm', 'Either works. I lean to {lean}.']]);
  add('advise.tail.leans', 3, [['thinking', 'Not by a lot, though.'], ['calm', 'Just about.']]);

  add('hint.open', 3, [['thinking', 'Nobody’s in yet. How many players still act after you?'], ['calm', 'Think about your seat before you play this.']]);
  add('hint.limped', 3, [['thinking', '{LimpersP} just called. What does just calling usually mean?']]);
  add('hint.bbOption', 3, [['thinking', 'Nobody raised. What does it cost you to see the flop?']]);
  add('hint.vsRaise', 3, [['thinking', '{Raiser} raised. What kind of hands do people raise with?'], ['thinking', 'It’s {call} to call. Does {hole} win often enough to pay that?']]);
  add('hint.vsReraise', 3, [['thinking', 'That’s a re-raise. How strong does that make them?']]);
  add('hint.short', 3, [['thinking', 'You have {bb} big blinds. All in, or fold?']]);
  add('hint.post', 3, [['thinking', '{Bettor} made {betSize}. What does a bet like that usually mean?'], ['calm', 'Compare the price with how often you win.']]);
  add('hint.post.draw', 3, [['thinking', 'You’re waiting for a card. Is the bet small enough to chase it?']]);
  add('hint.bet', 3, [['thinking', 'They checked to you. How strong are you, compared with them?'], ['thinking', 'Nobody bet. Is your hand good enough to bet, or better kept cheap?']]);

  /* ================= tapping him ================= */
  add('read.pre.wait', 3, [['calm', '{hole}. That’s {handWords}. Let’s see what they do first.']]);
  add('read.pre.out', 3, [['calm', 'You’re out of this one. Watch how they bet. It tells you how they play.']]);
  add('read.made.nothing', 3, [['calm', 'You’ve got nothing yet.'], ['thinking', 'No pair. Nothing yet.']]);
  add('read.made.boardPlays', 3, [['calm', 'Your best hand is just the cards on the table. Everyone has that.']]);
  add('read.made.weak-pair', 3, [['calm', '{handName}. A small pair. It doesn’t beat much.']]);
  add('read.made.second-pair', 3, [['calm', '{handName}. A middling hand.']]);
  add('read.made.top-pair', 3, [['pleased', '{handName}, the highest pair you can make here. Good, most of the time.']]);
  add('read.made.overpair', 3, [['pleased', '{handName}, bigger than any card on the table. Strong.']]);
  add('read.made.two-pair', 3, [['pleased', '{handName}. That’s strong.']]);
  add('read.made.set', 3, [['impressed', '{handName}. Very strong, and hard for them to see coming.']]);
  add('read.made.trips', 3, [['pleased', '{handName}. Strong, but someone could share it with a better other card.']]);
  add('read.made.big', 3, [['impressed', '{handName}. A big hand.']]);
  add('read.draw', 3, [['thinking', '{DrawName}: {outs} cards make your hand. About {hitPct}% {byWhen}.']]);
  add('read.drawprice', 3, [['thinking', 'The next card makes your hand about {hitNext}% of the time. The bet needs {odds}%.']]);
  add('read.price.bet', 3, [['calm', 'It’s {call} to call into {pot}. You need to win {odds}% of the time for that to pay.']]);
  add('read.price.free', 3, [['calm', 'Nobody’s bet.']]);
  add('read.threat', 3, [['thinking', 'Watch out: {threat}.']]);
  add('read.between', 3, [['calm', 'Nothing on. Deal the next one.']]);
  add('explain.outs', 3, [['calm', 'Count the cards that would make your hand. Each one is worth about 2% per card to come. Compare that with the price.']]);
  add('explain.potodds', 3, [['calm', 'If it costs 25 to win 75, you need to win one time in four: 25%. If you win more often than that, call.']]);
  add('explain.equity', 3, [['calm', 'The question is always the same: how often does my hand win, and what does it cost to find out?']]);
  add('explain.kicker', 3, [['calm', 'With the same pair, the higher other card wins. That card matters.']]);
  add('explain.position', 3, [['calm', 'Acting last is an advantage: you see what everyone else does before you decide.']]);

  /* ================= everyone folded to you ================= */
  add('open.good.premium.why.foldwin', 2, [
    ['calm', 'Everyone folded. That happens with a great hand, and raising {hole} was still right.'],
    ['pleased', 'They all folded to your {hole}. It’s a small win, but the raise was right. Just calling would have let weaker hands in cheaply.'],
    ['calm', 'No callers for your {hole}. That’s fine. With a hand this good, a raise is always right, even when it only wins the blinds.']]);
  add('open.good.steal.why.foldwin', 2, [
    ['pleased', 'Everyone folded. That’s the point of raising from a late seat: you win the blinds without a fight.'],
    ['calm', 'They folded. Raising {hole} {seatFrom} won the pot straight away. That’s how late seats make money.']]);
  add('open.good.why.foldwin', 4, [['calm', 'Everyone folded to your raise. A small, easy win.']]);
  add('iso.good.why.foldwin', 2, [['pleased', 'They folded. Raising the players who just called often wins it straight away.']]);
  add('bb.raise.good.why.foldwin', 2, [['pleased', 'They folded to your raise from the big blind. They had weak hands, as usual when players just call.']]);
  add('vsraise.raise.value.why.foldwin', 2, [['calm', 'They folded to your re-raise. With {hole} you’d have liked a call, but taking the pot is fine.']]);
  add('short.push.good.why.foldwin', 2, [['pleased', 'Everyone folded to your all in. When you’re short, winning the blinds keeps you alive.']]);
  add('short.reshove.good.why.foldwin', 2, [['pleased', 'They folded to your all in. You win their raise as well as the blinds.']]);
  add('bet.value.why.foldwin', 2, [
    ['calm', 'They folded to your bet. With {handName} you’d have liked a call. A slightly smaller bet might keep them in next time.'],
    ['calm', 'Everyone folded. Betting {handName} was still right: you can’t get paid if you don’t bet.']]);
  add('bet.semi.why.foldwin', 2, [['pleased', 'They folded to your bet with {drawName}. That’s the first way a bluff with a draw wins.']]);
  add('bet.bluff.good.why.foldwin', 2, [
    ['pleased', 'They folded. The bluff worked: one player, who’d only checked.'],
    ['impressed', 'Nicely done. You had nothing, they had nothing much, and your bet took it.']]);
  add('bet.bluff.close.why.foldwin', 4, [['calm', 'They folded. That bluff was a close call, and it worked this time.']]);
  add('post.raise.value.why.foldwin', 2, [['calm', 'They folded to your raise. With {handName} a call would have been nice, but the pot’s yours.']]);
  add('post.raise.semi.why.foldwin', 2, [['pleased', 'They folded to your raise with {drawName}. The bluff with a draw worked straight away.']]);

  /* ================= tips: the third tap, one per lesson ================= */
  add('tip.bigHands', 3, [
    ['calm', 'To win more with big hands: raise the same amount you raise with other hands, so they can’t tell. Against players who fold a lot, a slightly smaller raise keeps them in.'],
    ['calm', 'Don’t just call with a great hand to trick people. It lets weak hands in cheaply, and great hands lose more often against lots of players.']]);
  add('tip.starting-hands', 3, [['calm', 'Tip: pairs and two high cards are the hands to play. Low cards of different suits are almost always a fold.']]);
  add('tip.position', 3, [['calm', 'Tip: count how many players act after you. The more there are, the stronger your hand needs to be.']]);
  add('tip.raise-or-fold', 3, [['calm', 'Tip: when you’re first in, your choices are raise or fold. Just calling is almost never best.']]);
  add('tip.calling-raises', 3, [['calm', 'Tip: when someone raises, fold most hands. Keep playing with pairs and your best high cards.']]);
  add('tip.bb-defence', 3, [['calm', 'Tip: in the big blind, call raises more often, because it’s cheaper for you. But not with junk.']]);
  add('tip.short-stack', 3, [['calm', 'Tip: watch your stack. Under about ten big blinds, it’s all in or fold.']]);
  add('tip.three-bet', 3, [['calm', 'Tip: re-raise with your very best hands. With good-but-not-great ones, just call or fold.']]);
  add('tip.the-basics', 3, [['calm', 'Tip: when it’s free, always check. You can only lose chips by betting or calling.']]);
  add('tip.pot-odds', 3, [['calm', 'Tip: small bets are cheap to call; big bets need strong hands. The size of the bet matters as much as your cards.']]);
  add('tip.drawing-odds', 3, [['calm', 'Tip: a flush draw with two cards to come hits about 1 time in 3. With one card to come, about 1 in 5.']]);
  add('tip.river-bets', 3, [['calm', 'Tip: when a quiet player suddenly bets big on the last card, believe them.']]);
  add('tip.hand-strength', 3, [['calm', 'Tip: look at the board. If three cards of one suit are showing, a flush is possible. If four are in a row, a straight is.']]);
  add('tip.raising-for-value', 3, [['calm', 'Tip: when someone bets and you have two pair or better, raise. Worse hands will often call.']]);
  add('tip.value-betting', 3, [['calm', 'Tip: when your hand is strong and they check to you, bet. They can’t pay you if you don’t.']]);
  add('tip.pot-control', 3, [['calm', 'Tip: with one pair, you usually want a small pot. Check, and call small bets.']]);
  add('tip.bluffing', 3, [['calm', 'Tip: bluff one player, when they’ve checked. Never bluff someone who calls everything.']]);
  add('tip.semi-bluff', 3, [['calm', 'Tip: bet your draws against one player. You can win if they fold, or if you make your hand.']]);
  add('tip.watching', 3, [['calm', 'Tip: while you’re out, watch who bets and who calls. It tells you how each of them plays.']]);
  add('tip.general', 3, [['calm', 'Tip: most hands are folds. The money comes from the few you play well.'], ['calm', 'Tip: play fewer hands, and play them with a raise.']]);

  /* ================= the hand, summed up (a tap, when there's no verdict) ================= */
  add('sum.won', 3, [['pleased', 'You won that one. Nothing to fix.'], ['calm', 'A win, and you played it fine.']]);
  add('sum.allFolded', 3, [['calm', 'Everyone folded to you. Nothing to fix.']]);
  add('sum.lost', 3, [['calm', 'You lost that one, but you didn’t do anything wrong.'], ['unlucky', 'A loss, but not a mistake.']]);
  add('sum.folded', 3, [['calm', 'You folded, and that was fine.']]);
  add('sum.even', 3, [['calm', 'Nothing much happened in that one.']]);
  add('read.wait', 3, [['thinking', 'Let’s see how the cards land.'], ['calm', 'Nothing to do now but watch.'], ['calm', 'Let’s see who has it. Ask me again after.']]);
  add('read.cards', 3, [['calm', 'Have a look at your cards first.'], ['calm', 'Turn your cards over, then ask me.']]);
  add('tap.done', 3, [['calm', 'That’s all I’ve got on this one.'], ['calm', 'Nothing more to add here.'], ['calm', 'That’s everything. Play on.']]);

  /* ================= more ways to say the things he says most ================= */
  add('dealt.weak.early', 4, [['calm', '{hole}. Not one to play from here.'], ['calm', '{hole}. Wait for a better one.']]);
  add('dealt.weak.middle', 4, [['calm', '{hole}. Let this one go.']]);
  add('dealt.weak.late', 4, [['calm', '{hole}. Even from a good seat, that’s weak.']]);
  add('dealt.weak.blinds', 4, [['calm', '{hole}. Only if it’s free.']]);
  add('dealt.middle.early', 4, [['thinking', '{hole}. Too early in the order for this one.']]);
  add('dealt.strong.late', 4, [['pleased', '{hole}. Nice. A good hand and a good seat.']]);
  add('advise.open.fold', 3, [['calm', 'Let {hole} go. Not strong enough from here.'], ['calm', 'Fold. There are better spots to play.']]);
  add('advise.open.raise', 3, [['pleased', 'That’s a raise. {hole} {seatFrom}: make it {to}.']]);
  add('advise.bbOption.check', 3, [['calm', 'It’s free. Check.'], ['calm', 'Check, and see what comes.']]);
  add('advise.vsRaise.fold', 3, [['calm', 'Fold. A raise usually beats {hole}.']]);
  add('advise.vsRaise.call', 3, [['calm', 'Call. {hole} does well enough against that raise.']]);
  add('advise.post.fold', 3, [['calm', 'Let it go. {handName} doesn’t win often enough against that bet.']]);
  add('advise.post.call', 3, [['calm', 'Call. {handName} is good enough for the price.']]);
  add('advise.bet.check', 3, [['calm', 'Check. Middling hands want small pots.']]);
  add('advise.bet.check.weak', 3, [['calm', 'Check. Nothing to bet with, and no reason to bluff.']]);
  add('advise.bet.bet', 3, [['pleased', 'Bet about {to}. You’re ahead, so get paid.']]);
  add('story.weak.one', 3, [['thinking', '{Opp} checked. Not much strength there.']]);
  add('story.weak.all', 3, [['calm', 'Checks all round. Nobody likes their hand much.']]);
  add('story.strong.one', 3, [['thinking', '{Opp} is betting. Usually that’s a real hand.']]);
  add('story.calling.one', 3, [['calm', '{Opp} just called. Something middling, most likely.']]);
  add('story.calling.again.one', 3, [['calm', '{Opp} is just calling, card after card. Something middling, most likely.']]);
  add('open.good.premium.now', 2, [['pleased', 'Good. Raise the big ones.']]);
  add('post.fold.good.now', 2, [['pleased', 'Good. Save your chips.']]);
  add('vsraise.fold.good.now', 2, [['pleased', 'Right. Not against a raise.']]);

  /* ================= short because of THEM (owner 29 Sep 2026) =================
     You cover a short opponent: the hand is only worth their stack, so it
     plays like a short stack, but it's theirs. <key>.opp is said in place
     of <key> then ("Lucy only has 7 big blinds", not "you're short"). */
  add('short.push.good.now.opp', 2, [['pleased', 'Good. All in.'], ['pleased', 'Right. Against a stack that small, all in is the play.']]);
  add('short.push.good.why.opp', 2, [['calm', '{ShortOpp} only had {bb} big blinds, and that’s all you could win or lose. All in with {hole} was right: it makes them decide now, for everything.']]);
  add('short.push.close.why.opp', 4, [['calm', 'Fine. All in with {hole} against {shortOpp}’s {bb} big blinds was a close call.']]);
  add('short.push.loose.why.opp', 2, [['thinking', '{ShortOpp} only has {bb} big blinds, but they can still have a good hand. {hole} {seatFrom} was too weak to put them all in.']]);
  add('short.fold.missed.now.opp', 1, [['thinking', '{ShortOpp} is short. That was an all in.']]);
  add('short.fold.missed.why.opp', 2, [['thinking', '{ShortOpp} only had {bb} big blinds. Against a stack that small you can go all in with lots of hands: they can’t hurt you much. {hole} {seatFrom} was an all in.']]);
  add('short.fold.missed.why.leans.opp', 2, [['thinking', 'Folding {hole} against {shortOpp}’s {bb} big blinds was a bit too careful. That’s an all in.']]);
  add('short.fold.close.why.opp', 4, [['calm', 'Fine. Folding {hole} against a short stack was a close call.']]);
  add('short.fold.good.why.opp', 4, [['calm', 'Folding {hole} was right. {ShortOpp} is short, but that hand is too weak even so.']]);
  add('short.raise.small.now.opp', 3, [['thinking', 'Against a stack that short, just put them all in.']]);
  add('short.raise.small.why.opp', 2, [['calm', '{ShortOpp} only had {bb} big blinds. A normal raise puts most of their chips in anyway, so go all in: they have to decide now, for everything.']]);
  add('short.limp.now.opp', 1, [['wince', 'Against a stack that short, all in or fold.']]);
  add('short.limp.why.opp', 2, [['calm', '{ShortOpp} only had {bb} big blinds. Just calling lets them see cards cheaply. All in with good hands, fold the rest.']]);
  add('short.flat.now.opp', 3, [['thinking', 'They’re short. Put them all in instead.']]);
  add('short.flat.why.opp', 2, [['calm', '{ShortOpp} only had {bb} big blinds. Calling leaves them room to play. {hole} wins about {eq}% here: all in instead.']]);
  add('short.reshove.good.why.opp', 2, [['calm', 'All in over the raise with {hole} was right. {ShortOpp} only had {bb} big blinds. You win about {eq}% if they call, and sometimes they fold.']]);
  add('short.push.good.why.foldwin.opp', 2, [['pleased', 'Everyone folded to your all in. Against a short stack, the blinds are a fine win.']]);
  add('advise.open.allin.opp', 3, [['calm', '{ShortOpp} only has {bb} big blinds. {hole} is good enough: go all in.']]);
  add('advise.limped.allin.opp', 3, [['calm', '{ShortOpp} only has {bb} big blinds, and {hole} is good enough: all in.']]);
  add('advise.bbOption.allin.opp', 3, [['calm', '{ShortOpp} only has {bb} big blinds, and {hole} is strong. All in.']]);
  add('advise.vsRaise.allin.opp', 3, [['calm', '{ShortOpp} only has {bb} big blinds. {hole} wins about {eq}% here: all in.']]);
  add('advise.vsReraise.allin.opp', 3, [['calm', 'All in. {hole} is strong enough, about {eq}%, and {shortOpp} only has {bb} big blinds.']]);
  add('advise.short.allin.opp', 3, [['calm', '{ShortOpp} only has {bb} big blinds, so that’s all this hand is worth. All in with {hole}.']]);
  add('advise.short.fold.opp', 3, [['calm', 'Fold. {ShortOpp} only has {bb} big blinds, so it’s all in or fold, and {hole} is a fold from here.']]);
  add('hint.short.opp', 3, [['thinking', '{ShortOpp} only has {bb} big blinds. All in, or fold?']]);
  add('lesson.short-stack.opp', 2, [
    ['calm', 'You can only win or lose what the smaller stack has. When that’s about ten big blinds or fewer, stop making small raises: go all in or fold. That’s called a shove.']]);
  add('tip.short-stack.opp', 3, [['calm', 'Tip: look at the smaller stack. When it’s under about ten big blinds, it’s all in or fold, even for you.']]);
  add('again.short-stack.opp', 3, [['thinking', 'A short stack again. All in or fold.']]);

  /* ================= a draw, all in (owner 29 Sep 2026) =================
     Betting a draw is good; betting ALL your chips on one usually isn't. */
  add('bet.semi.shove.now', 3, [['thinking', 'All your chips on a draw? That’s a lot to risk.'], ['wince', 'All in on a draw. Risky.']]);
  add('bet.semi.shove.why', 2, [
    ['thinking', 'Betting {drawName} is good, but not with all your chips. They won’t fold often enough, and when they call you usually miss. A smaller bet, or a check, keeps you in the game.'],
    ['calm', 'All in with {drawName} risked everything on a card that mostly doesn’t come. Bet draws small, or check and see the next card.']]);
  add('bet.semi.shove.close.why', 4, [['calm', 'All in with {drawName} was close. A smaller bet, or a check, risks much less for nearly the same.']]);
  add('bet.check.draw.deep.why', 4, [['calm', 'Checking {drawName} was right. A proper bet would have been nearly all your chips, and that’s too much to risk on a card that may not come.']]);
  add('post.raise.semi.shove.now', 3, [['thinking', 'All in on a draw? Risky.']]);
  add('post.raise.semi.shove.why', 2, [
    ['thinking', 'All in with {drawName} risked everything on a card that usually doesn’t come, and after betting, they rarely fold. Calling at the right price is the safer way to chase it.']]);
  add('advise.bet.check.draw', 3, [
    ['calm', 'Check. {DrawName} is worth a bet, but here a proper bet is nearly all your chips. See the next card for free instead.']]);
  add('lesson.draw-shove', 2, [
    ['calm', 'A draw is worth a bet, but not all your chips. If they call, you need the card to come, and most of the time it won’t. Save all in for hands that are already strong.']]);
  add('tip.draw-shove', 3, [['calm', 'Tip: with a draw, bet about half the pot. If that would be most of your chips, check instead.']]);
  add('again.draw-shove', 3, [['thinking', 'All in on a draw again. That risks too much.']]);

  /* ================= a hand that hurt (owner 29 Sep 2026) =================
     You're out, or you lost a big pot: a short word, no lesson. The
     verdict and the lesson are still there if you tap him. */
  add('comfort.out', 1, [['unlucky', 'Out. That one hurt. Tap me when you want to go over it.'], ['unlucky', 'That’s the run over. We’ll go again. Tap me if you want to look back at that hand.']]);
  add('comfort.out.fine', 1, [['unlucky', 'Out, but you played that one fine. It just didn’t go your way.'], ['unlucky', 'Unlucky. The play was fine; the cards weren’t. We’ll go again.']]);
  add('comfort.hurt', 1, [['wince', 'That one hurt. Tap me if you want to go over it.'], ['unlucky', 'A big one to lose. We can look at it later. Tap me.']]);
  add('comfort.fine', 1, [['unlucky', 'Unlucky. You played that fine; it just didn’t go your way.'], ['unlucky', 'That hurts, but the play was fine. Shake it off.']]);

  /* ================= calling an all in (the audit, 30 Sep 2026) =================
     Fold or call is the whole decision: the price (what you put in against
     what you can win: only what you match) against how often you'd win.
     Plain words, no percentages: {needWords} is "about 1 time in 3".
     <key>.near: you were nearly out anyway (a gamble is more reasonable). */
  add('allcall.call.good.now', 2, [['pleased', 'Good call.']]);
  add('allcall.call.good.why', 2, [['calm', 'Calling {call} to win {win} with {hole} was right. You only needed to win {needWords}, and {hole} does better than that against an all in like that.']]);
  add('allcall.call.good.why.near', 2, [['calm', 'Calling your last {call} with {hole} was right. You were nearly out anyway, and a chance to win {win} was worth taking.']]);
  add('allcall.call.close.why', 4, [['calm', 'Calling {call} to win {win} with {hole} was close. You needed to win {needWords}, and {hole} is right on the edge of that.']]);
  add('allcall.call.close.why.near', 4, [['calm', 'That call was close, but you were nearly out anyway. A gamble to win {win} was reasonable.']]);
  add('allcall.call.bad.now', 1, [['thinking', 'That call costs too much for that hand.']]);
  add('allcall.call.bad.now.leans', 3, [['thinking', 'A bit expensive for that hand.']]);
  add('allcall.call.bad.why', 2, [['thinking', 'Calling {call} with {hole} was too much. You could only win {win}, so you needed to win {needWords}, and {hole} wins less often than that against an all in.']]);
  add('allcall.call.bad.why.leans', 2, [['thinking', 'Calling {call} with {hole} there was a bit loose for the price.']]);
  add('allcall.call.bad.why.near', 2, [['thinking', 'Even nearly out, calling with {hole} was too loose. You needed to win {needWords}, and it wins less often than that. A better hand will come.']]);
  add('allcall.fold.good.why', 4, [['calm', 'Folding {hole} was right. Calling {call} to win {win} needed a hand that wins {needWords}.']]);
  add('allcall.fold.close.why', 4, [['calm', 'Folding {hole} was fine. Calling would have been close too.']]);
  add('allcall.fold.missed.now', 1, [['thinking', 'That was worth a call.']]);
  add('allcall.fold.missed.now.leans', 3, [['thinking', 'I’d have called that.']]);
  add('allcall.fold.missed.why', 2, [['thinking', 'Folding {hole} gave up a good price. It cost {call} to win {win}: you only needed to win {needWords}, and {hole} wins more often than that.']]);
  add('allcall.fold.missed.why.leans', 2, [['thinking', 'Folding {hole} was a little too careful for that price. It cost {call} to win {win}.']]);
  add('allcall.fold.missed.why.near', 2, [['thinking', 'You were nearly out anyway. {hole} was worth calling with there: it cost {call} to win {win}.']]);
  add('advise.allcall.call', 3, [['calm', 'Call. It costs {call} to win {win}. You need to win {needWords}, and {hole} does better than that.']]);
  add('advise.allcall.call.near', 3, [['calm', 'Call. You’re nearly out anyway, and this is a fair chance to win {win}.']]);
  add('advise.allcall.fold', 3, [['calm', 'Fold. It costs {call} to win {win}. You’d need to win {needWords}, and {hole} wins less often than that.']]);
  add('advise.allcall.fold.near', 3, [['calm', 'Fold. Even nearly out, {hole} is too weak for this price. Wait for a better one.']]);
  add('hint.allcall', 3, [['thinking', 'It costs {call} to win {win}. How often does {hole} need to win to make that worth it?']]);

  /* all in over someone's raise (not an opening all in: no "players after you") */
  add('short.reshove.loose.now', 1, [['surprised', 'All in over a raise with that?']]);
  add('short.reshove.loose.now.leans', 3, [['thinking', 'A bit loose to go all in over a raise.']]);
  add('short.reshove.loose.why', 2, [['thinking', 'Going all in over {raiser}’s raise with {hole} was too loose. A raise usually means a good hand, and {hole} doesn’t win often enough against one.']]);
  add('short.reshove.loose.why.leans', 2, [['thinking', 'All in over the raise with {hole} was a little loose.']]);
  add('short.reshove.close.why', 4, [['calm', 'Fine. All in over the raise with {hole} was a close call.']]);

  return { lines:L, terms:TERMS };
})();
if (typeof window !== 'undefined') window.CoachLines = CoachLines;
