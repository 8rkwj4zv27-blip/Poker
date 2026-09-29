"use strict";

/* ============================================================
   P.I.P.'S LINES  (docs/coach/BRAIN_PLAN.md, step 2: before the flop)

   The library his brain speaks from. Flat and plain (the owner's brief):
   clear, informative, the odd short reaction; never a nickname for the
   player, no catchphrases, no puns, clean. He explains a term as he uses
   it, as if to someone who doesn't know it yet.

   Each entry is [notch, mood, text]; {slots} are filled by coach-talk.js
   from the brain's judgement. The notch is the lowest talk-slider setting
   the line plays at (a judged line's notch comes from its confidence; see
   coach-talk.js). Keys:
     dealt.<band>.<seat group>   your cards, with where you sit (facts)
     <tag>.now                   a word right after you act
     <tag>.now.leans             ...when the verdict is a lean, not clear
     <tag>.why                   the reason, after the hand
     <tag>.why.leans             ...a lean
     lesson.<lesson>             the first time a lesson comes up
     lead.<how>                  a lead-in to the reason: judge the
                                 decision, not the result
   Slots: {hole} {pct} (top {pct}% of starting hands) {range} (the top
   {range}% a sound player plays here) {seatOn} {seatFrom} ({SeatFrom} to
   start a sentence) {behindP}
   {bb} {size} {call} {odds} {eq} {need} {raiser} {limpersP}
   ============================================================ */
const CoachLines = (() => {
  const L = {};
  const add = (key, notch, rows) => { L[key] = (L[key] || []).concat(rows.map(r => [notch, r[0], r[1]])); };

  /* ---------------- dealt: your cards and your seat (facts) ---------------- */
  add('dealt.premium.early', 4, [
    ['pleased', '{hole} {seatOn}. Top {pct}%. Good enough to raise from anywhere.'],
    ['impressed', '{hole}. Even with {behindP} to act after you, that’s a raise.'],
    ['pleased', '{hole} {seatOn}. One of the best starts there is.']]);
  add('dealt.premium.middle', 4, [
    ['pleased', '{hole} {seatOn}. Top {pct}% of starting hands.'],
    ['impressed', '{hole}. A hand to play properly.']]);
  add('dealt.premium.late', 4, [
    ['impressed', '{hole} {seatOn}. Strong cards and a good seat.'],
    ['pleased', '{hole}, and you act late. That’s the best of both.']]);
  add('dealt.premium.blinds', 4, [
    ['pleased', '{hole} {seatOn}. Top {pct}%. Don’t let it go cheaply.'],
    ['impressed', '{hole}. A strong hand, even from the blinds.']]);
  add('dealt.strong.early', 4, [
    ['calm', '{hole} {seatOn}. Top {pct}%. Playable, even this early.'],
    ['thinking', '{hole}. Good, but {behindP} still to act after you.']]);
  add('dealt.strong.middle', 4, [
    ['calm', '{hole} {seatOn}. Top {pct}%. A decent hand from here.'],
    ['pleased', '{hole}. That’s one to raise if nobody has yet.']]);
  add('dealt.strong.late', 4, [
    ['pleased', '{hole} {seatOn}. Plenty good enough from this seat.'],
    ['calm', '{hole}. Late position and a good hand. That’s a comfortable spot.']]);
  add('dealt.strong.blinds', 4, [
    ['calm', '{hole} {seatOn}. Top {pct}%. Good, but you’ll act first after the flop.'],
    ['thinking', '{hole}. A good hand in a bad seat. Worth playing, carefully.']]);
  add('dealt.middle.early', 4, [
    ['thinking', '{hole} {seatOn}. Top {pct}%. From this early, that’s usually a fold.'],
    ['calm', '{hole}. With {behindP} still to act, this one’s on the edge.'],
    ['thinking', '{hole} {seatOn}. Middling cards in the worst seat.']]);
  add('dealt.middle.middle', 4, [
    ['thinking', '{hole} {seatOn}. Top {pct}%. Close to the edge from here.'],
    ['calm', '{hole}. It depends what happens in front of you.']]);
  add('dealt.middle.late', 4, [
    ['calm', '{hole} {seatOn}. Top {pct}%. From this seat, that can be raised.'],
    ['pleased', '{hole}. Not much of a hand, but a good seat to play it from.']]);
  add('dealt.middle.blinds', 4, [
    ['calm', '{hole} {seatOn}. Top {pct}%. Depends on the price.'],
    ['thinking', '{hole}. You’ve paid part of it already. Let’s see what it costs.']]);
  add('dealt.weak.early', 4, [
    ['calm', '{hole} {seatOn}. That’s a fold.'],
    ['calm', '{hole}. Bottom half of starting hands. Let it go.'],
    ['wince', '{hole} {seatOn}. Easy fold.']]);
  add('dealt.weak.middle', 4, [
    ['calm', '{hole}. Not one to play from here.'],
    ['calm', '{hole} {seatOn}. Fold and wait.']]);
  add('dealt.weak.late', 4, [
    ['thinking', '{hole} {seatOn}. Weak, even from a good seat.'],
    ['calm', '{hole}. Most of the time this goes in the muck.']]);
  add('dealt.weak.blinds', 4, [
    ['calm', '{hole} {seatOn}. If it’s free, check. If not, fold.'],
    ['wince', '{hole}. Not worth paying more for.']]);

  /* ---------------- nobody in: opening the pot ---------------- */
  add('open.good.premium.now', 2, [
    ['pleased', 'Good raise.'], ['pleased', 'Raised. That’s the way to play it.'], ['impressed', 'Right. Make them pay to see a flop.']]);
  add('open.good.premium.why', 2, [
    ['pleased', '{hole} is top {pct}%. Raising builds a pot while you’re well ahead, and makes worse hands pay to continue.'],
    ['pleased', 'With {hole}, a raise was right. Strong hands want the money in early.'],
    ['calm', '{hole} {seatOn}. Raising first in gives you two ways to win: they fold, or they call and you’re usually ahead.']]);
  add('open.good.steal.now', 2, [
    ['pleased', 'Good raise from there.'], ['calm', 'That’s a fine steal.'], ['pleased', 'Using your seat. Good.']]);
  add('open.good.steal.why', 2, [
    ['calm', '{hole} isn’t strong on its own, but {seatFrom} with only {behindP} left to act, a raise often wins the blinds straight away.'],
    ['pleased', 'Raising {hole} {seatFrom} was right. A sound player raises about the top {range}% there. Late seats can play more hands.'],
    ['calm', 'A steal: raising late with a hand you wouldn’t play early. Only {behindP} could wake up with something.']]);
  add('open.good.now', 4, [
    ['calm', 'Raised. Good.'], ['calm', 'That’s a standard raise.'], ['pleased', 'Good. First in, raise.']]);
  add('open.good.why', 4, [
    ['calm', '{hole} {seatFrom} was a raise. It’s in the top {range}% a sound player opens there.'],
    ['calm', 'Nobody had come in, so raising {hole} was right. Raise first in, don’t just call.']]);
  add('open.loose.close.why', 4, [
    ['thinking', '{hole} {seatFrom} is just outside a normal range, top {range}%. Close enough. It’s not a mistake.'],
    ['calm', 'A touch loose to raise {hole} {seatFrom}. It’s close. I wouldn’t worry about it.']]);
  add('open.loose.now', 1, [
    ['wince', 'Too loose from there.'], ['thinking', 'That’s a weak hand to raise with.'], ['wince', 'Hm. Not from that seat.']]);
  add('open.loose.now.leans', 3, [
    ['thinking', 'A bit loose.'], ['thinking', 'That’s a stretch from there.']]);
  add('open.loose.why', 2, [
    ['thinking', '{hole} is top {pct}%. {SeatFrom}, with {behindP} still to act, a sound player raises only the top {range}%. That hand should be folded.'],
    ['calm', 'Raising {hole} {seatFrom} was too loose. The more players left behind you, the more likely one of them has you beaten.'],
    ['thinking', 'The seat matters. {hole} can be raised from the button. {SeatFrom}, it’s a fold.']]);
  add('open.loose.why.leans', 2, [
    ['thinking', '{hole} {seatFrom} was a little loose. A sound player raises the top {range}% there. Yours was top {pct}%.'],
    ['calm', 'Not a big mistake, but {hole} is outside a normal range {seatFrom}. Tighten up a little there.']]);
  add('open.big.now', 3, [
    ['thinking', 'That’s a big raise.'], ['thinking', 'Bigger than it needs to be.']]);
  add('open.big.why', 2, [
    ['calm', 'You raised to {size} big blinds. Two and a half to three is plenty. Bigger only scares away the hands you want to play against.'],
    ['thinking', 'The raise was big: {size} big blinds. Good hand, but a normal size keeps worse hands in.']]);
  add('open.shove.now', 1, [
    ['surprised', 'All in? That’s a lot to risk.'], ['wince', 'That’s far too much.']]);
  add('open.shove.why', 2, [
    ['thinking', 'Going all in with {bb} big blinds risks everything to win the blinds. A normal raise does the same job for a fraction of it.'],
    ['calm', 'All in, first in, with {bb} big blinds. The only hands that call you have you beaten or close to it. Raise normally instead.']]);
  add('open.fold.strong.now', 1, [
    ['surprised', 'You folded that?'], ['wince', 'That’s a good hand to fold.']]);
  add('open.fold.strong.now.leans', 3, [
    ['thinking', 'I’d have raised that.'], ['thinking', 'That one was playable.']]);
  add('open.fold.strong.why', 2, [
    ['thinking', '{hole} is top {pct}% of starting hands. Nobody had raised, so that’s a raise, even {seatFrom}.'],
    ['calm', 'You folded {hole}. A sound player raises about the top {range}% {seatFrom}, and that hand is well inside it.']]);
  add('open.fold.strong.why.leans', 2, [
    ['thinking', '{hole} {seatFrom} was worth a raise. It’s inside the top {range}%. Tight isn’t wrong, but that was a bit too tight.'],
    ['calm', 'Folding {hole} {seatFrom} is a small mistake. With nobody in, it’s good enough to raise.']]);
  add('open.fold.close.why', 4, [
    ['calm', '{hole} {seatFrom} is right on the edge. Folding it is fine.'],
    ['thinking', 'That fold was close. Raise or fold, both are reasonable there.']]);
  add('open.fold.disciplined.now', 2, [
    ['pleased', 'Good fold.'], ['calm', 'Disciplined. Good.'], ['pleased', 'Right. Not from there.']]);
  add('open.fold.disciplined.why', 2, [
    ['pleased', '{hole} looks playable, but {seatFrom} with {behindP} to act, it’s a fold. You’ll see better spots for it.'],
    ['calm', 'Folding {hole} {seatFrom} was right. Early seats need stronger hands, because more players can have you beaten.']]);
  add('open.fold.good.why', 4, [
    ['calm', 'Fine fold. {hole} isn’t worth playing from there.'],
    ['calm', 'Folding {hole} was right. Most hands are folds.']]);

  /* ---------------- limping: calling the big blind ---------------- */
  add('limp.strong.now', 1, [
    ['thinking', 'Just a call? Raise that.'], ['wince', 'That hand deserves a raise.']]);
  add('limp.strong.now.leans', 3, [
    ['thinking', 'I’d raise that instead.'], ['thinking', 'A raise would be better.']]);
  add('limp.strong.why', 2, [
    ['thinking', 'You just called {seatFrom} with {hole}. That’s called limping. With a good hand, raise: it builds the pot and thins the field while you’re ahead.'],
    ['calm', 'Limping {hole} lets everyone in cheaply. Good hands want fewer opponents and more money in the middle. Raise them.']]);
  add('limp.strong.why.leans', 2, [
    ['thinking', 'Calling with {hole} {seatFrom} was a small mistake. It’s good enough to raise, and raising is how good hands earn.'],
    ['calm', '{hole} {seatFrom} was a raise, not a call. First in, raise or fold.']]);
  add('limp.weak.now', 1, [
    ['wince', 'Calling with that? Fold it.'], ['thinking', 'That’s a limp with a weak hand.']]);
  add('limp.weak.now.leans', 3, [
    ['thinking', 'I’d have folded that.'], ['thinking', 'Hm. Raise or fold, usually.']]);
  add('limp.weak.why', 2, [
    ['thinking', 'You called the big blind with {hole}. That’s limping. With a weak hand you’re paying to play a pot you’ll rarely win. Fold it.'],
    ['calm', 'Limping {hole} {seatFrom} costs chips over time. Weak hands out of a raised pot, and out of a limped one too.'],
    ['thinking', 'A limp with {hole}: it can’t win the pot now, and it’s usually behind later. Raise the good ones, fold the rest.']]);
  add('limp.weak.why.leans', 2, [
    ['calm', 'Calling with {hole} is a small leak. It’s just below a raising hand from there, so fold it.'],
    ['thinking', '{hole} {seatFrom} was close to a fold. Calling the big blind is the one option that rarely makes sense.']]);
  add('sb.complete.why', 4, [
    ['calm', 'Completing the small blind with {hole} is cheap. It’s fine, but you’ll play the hand out of position.'],
    ['thinking', 'Topping up the small blind is fine with {hole}. Just remember you act first after the flop.']]);

  /* ---------------- limpers in front ---------------- */
  add('iso.good.now', 2, [
    ['pleased', 'Good. Raise the limpers.'], ['pleased', 'Right. Punish the limp.'], ['calm', 'Good raise.']]);
  add('iso.good.why', 2, [
    ['calm', '{limpersP} just called in front of you. Calling usually means a weak hand, so raising {hole} is right. You often take it there, or play it against one of them.'],
    ['pleased', 'Raising over limpers with {hole} was right. It gets heads-up against a weaker hand, with the initiative.']]);
  add('iso.loose.close.why', 4, [
    ['thinking', 'Raising the limper with {hole} was loose but reasonable. It’s close.'],
    ['calm', '{hole} over a limper is on the edge. Fine.']]);
  add('iso.loose.now', 1, [['thinking', 'That’s too weak to raise over them.'], ['wince', 'Loose.']]);
  add('iso.loose.now.leans', 3, [['thinking', 'A bit loose.'], ['thinking', 'Hm. That’s a stretch.']]);
  add('iso.loose.why', 2, [
    ['thinking', 'Raising over {limpersP} with {hole} was too loose. A limper still calls sometimes, and then you’re in a big pot with a weak hand.'],
    ['calm', '{hole} is top {pct}%. Raise the limpers with the top {range}% or so. That was outside it.']]);
  add('iso.loose.why.leans', 2, [
    ['thinking', '{hole} over a limper was a little loose. Keep that raise for stronger hands.']]);
  add('iso.limp.strong.now', 3, [['thinking', 'I’d raise that over them.'], ['thinking', 'That’s good enough to raise.']]);
  add('iso.limp.strong.why', 2, [
    ['thinking', '{limpersP} limped and you called behind with {hole}. That hand is good enough to raise and take control of the pot.'],
    ['calm', 'Calling behind a limper with {hole} leaves money on the table. Raise the strong ones.']]);
  add('iso.overlimp.why', 4, [
    ['calm', 'Calling behind the limpers with {hole} is fine. A cheap look at a flop with a hand that can hit big.'],
    ['thinking', 'Limping along with {hole} is reasonable. You want a big flop or nothing.']]);
  add('iso.fold.strong.now', 3, [['thinking', 'That was worth a raise.'], ['surprised', 'You could have raised that.']]);
  add('iso.fold.strong.why', 2, [
    ['thinking', 'Only {limpersP} limped in front of you. {hole} is strong enough to raise them. Limpers usually have weak hands.'],
    ['calm', 'Folding {hole} after a limp was too tight. A limp is an invitation to raise.']]);

  /* ---------------- the big blind ---------------- */
  add('bb.fold.free.now', 1, [['surprised', 'You could have checked. It was free.'], ['wince', 'That was free to check.']]);
  add('bb.fold.free.why', 2, [
    ['calm', 'In the big blind, nobody raised, so it cost nothing to see the flop. When checking is free, never fold.'],
    ['thinking', 'You folded when you could check. The big blind is already in. A free card can only help.']]);
  add('bb.check.why', 4, [
    ['calm', 'Checking the big blind with {hole} is right. A free flop.'],
    ['calm', 'Nothing wrong with a free look at the flop.']]);
  add('bb.check.strong.now', 3, [['thinking', 'You could raise that.'], ['thinking', 'I’d raise the limpers there.']]);
  add('bb.check.strong.why', 2, [
    ['thinking', '{hole} in the big blind with {limpersP} limping. That’s a hand to raise. Make them pay to see a flop against you.'],
    ['calm', 'Checking {hole} was fine, but a raise wins more. Limpers have weak hands.']]);
  add('bb.raise.good.now', 2, [['pleased', 'Good raise.'], ['pleased', 'Right. Make them pay.']]);
  add('bb.raise.good.why', 2, [
    ['pleased', 'Raising {hole} from the big blind over the limpers was right. You’re ahead of their range and you get paid.'],
    ['calm', 'A raise from the big blind with {hole}: good. Limpers rarely have much.']]);
  add('bb.raise.loose.why', 2, [
    ['thinking', '{hole} is weak to raise from the big blind. You had a free flop. You’ll be out of position the whole hand.'],
    ['calm', 'That raise with {hole} turned a free look into an expensive one. Check it.']]);
  add('bb.raise.loose.now', 3, [['thinking', 'You could have checked that.'], ['thinking', 'A raise with that, from the big blind?']]);
  add('bb.defend.good.now', 2, [['pleased', 'Good call.'], ['calm', 'Defend it. Good.']]);
  add('bb.defend.good.why', 2, [
    ['calm', 'You called {call} with {hole} in the big blind. The price was good: you needed about {need}% and had about {eq}%.'],
    ['pleased', 'Good defence of the big blind. You’d already put a big blind in, so the call was cheap for what you could win.'],
    ['calm', 'Big blind, getting a good price. {hole} was worth the call against a raise {seatFrom}.']]);

  /* ---------------- facing a raise ---------------- */
  add('vsraise.fold.good.now', 2, [['pleased', 'Good fold.'], ['calm', 'Good fold. Let it go.'], ['pleased', 'Disciplined.']]);
  add('vsraise.fold.good.why', 2, [
    ['calm', '{hole} looks good, but {raiser} raised. Against the hands that raise usually means, you’re winning about {eq}% and needed {need}%. Fold was right.'],
    ['pleased', 'Folding {hole} to a raise was right. Calling raises with hands that are behind is one of the most expensive habits in poker.'],
    ['calm', 'A raise tells you something. {raiser} raising means a stronger range, about the top {range}%. {hole} doesn’t do well against that.']]);
  add('vsraise.fold.close.why', 4, [
    ['thinking', 'Folding {hole} to that raise was close. About {eq}% against {need}% needed. Either is fine.'],
    ['calm', 'That fold was close. No problem.']]);
  add('vsraise.fold.priced.now', 1, [['surprised', 'That was worth a call.'], ['thinking', 'I’d have called that.']]);
  add('vsraise.fold.priced.now.leans', 3, [['thinking', 'I’d have called.'], ['thinking', 'The price was good there.']]);
  add('vsraise.fold.priced.why', 2, [
    ['thinking', 'You folded {hole} for {call}. You needed about {need}% to make that call pay, and had about {eq}%. That’s a call.'],
    ['calm', 'The price was right. {call} to call, and {hole} wins about {eq}% against a raise like that. You only needed {need}%.']]);
  add('vsraise.fold.priced.why.leans', 2, [
    ['thinking', 'Folding {hole} there was a bit tight. You needed about {need}% and had about {eq}%. A small edge, but it adds up.']]);
  add('vsraise.fold.strong.now', 1, [['surprised', 'You folded that? That’s a strong hand.'], ['wince', 'That was a re-raise, not a fold.']]);
  add('vsraise.fold.strong.why', 2, [
    ['thinking', '{hole} wins about {eq}% against a raise like {raiser}’s. That’s a hand to re-raise with, not fold.'],
    ['calm', 'Folding {hole} to one raise gives up a big edge. Top {pct}% is strong enough to play back.']]);
  add('vsraise.call.good.now', 4, [['calm', 'Called. Fine.'], ['calm', 'Good call.']]);
  add('vsraise.call.good.why', 2, [
    ['calm', 'Calling {raiser}’s raise with {hole} was fine. You needed about {need}% and had about {eq}%.'],
    ['pleased', 'Good call. {hole} holds up well enough against the hands that raise, and the price was right.']]);
  add('vsraise.call.close.why', 4, [
    ['thinking', 'Calling with {hole} there was close. About {eq}% against {need}% needed. Fine either way.'],
    ['calm', 'That call was on the edge. Not a mistake.']]);
  add('vsraise.call.weak.now', 1, [['wince', 'Calling a raise with that is expensive.'], ['thinking', 'That’s a weak hand to call a raise with.'], ['wince', 'Hm. Too loose.']]);
  add('vsraise.call.weak.now.leans', 3, [['thinking', 'A loose call.'], ['thinking', 'I’d have folded.']]);
  add('vsraise.call.weak.why', 2, [
    ['thinking', 'You called {raiser}’s raise with {hole}. Against the hands that raise usually means, it wins about {eq}%. You needed {need}%. That’s a fold.'],
    ['calm', 'Calling raises with weak hands is the most common leak there is. {hole} is often dominated: when you hit, they’ve hit better.'],
    ['thinking', 'A raise {seatFrom} means about the top {range}%. {hole} is behind most of that. Fold, and wait for a better spot.']]);
  add('vsraise.call.weak.why.leans', 2, [
    ['thinking', 'Calling with {hole} was a bit loose. About {eq}%, and you needed {need}%. Not a disaster, but it adds up.'],
    ['calm', 'That call with {hole} was slightly too loose. Tighten up against raises.']]);
  add('vsraise.call.value.now', 3, [['thinking', 'You could re-raise that.'], ['thinking', 'I’d raise again with that.']]);
  add('vsraise.call.value.why', 2, [
    ['thinking', 'Just calling with {hole} is fine, but it’s strong enough to re-raise. You win about {eq}% against a raise like that. Make them pay.'],
    ['calm', '{hole} against one raise: you were well ahead, about {eq}%. A re-raise, called a three-bet, builds the pot while you’re in front.']]);
  add('vsraise.raise.value.now', 2, [['pleased', 'Good re-raise.'], ['impressed', 'Three-bet. Good.'], ['pleased', 'Right. Raise it again.']]);
  add('vsraise.raise.value.why', 2, [
    ['pleased', 'Re-raising {raiser} with {hole} was right. You win about {eq}% against a raise like that. A re-raise is called a three-bet.'],
    ['calm', 'With {hole} against one raise, putting more in is right. Strong hands earn by building the pot.']]);
  add('vsraise.raise.close.why', 4, [
    ['thinking', 'Re-raising with {hole} was close. It works sometimes as a bluff. Fine.'],
    ['calm', 'That three-bet with {hole} was on the edge. Reasonable.']]);
  add('vsraise.raise.loose.now', 1, [['surprised', 'Re-raising with that?'], ['wince', 'That’s a lot to put in with that hand.']]);
  add('vsraise.raise.loose.why', 2, [
    ['thinking', 'You re-raised with {hole}. Against {raiser}’s range, it wins about {eq}%. When they call or raise again, you’re usually behind.'],
    ['calm', 'Re-raising with weak hands gets expensive. Keep the three-bet for strong hands, about the top {pct}% isn’t that.']]);

  /* ---------------- facing a re-raise ---------------- */
  add('vs3bet.fold.good.now', 2, [['pleased', 'Good fold.'], ['calm', 'Right. Let it go.']]);
  add('vs3bet.fold.good.why', 2, [
    ['calm', 'A re-raise usually means a very strong hand, about the top {range}%. {hole} wins about {eq}% against that. Folding was right.'],
    ['pleased', 'Good fold of {hole} to the re-raise. Two raises before the flop is a lot of strength.']]);
  add('vs3bet.fold.close.why', 4, [['thinking', 'Folding to the re-raise with {hole} was close. Fine.']]);
  add('vs3bet.fold.priced.now', 3, [['thinking', 'I’d have called that.']]);
  add('vs3bet.fold.priced.why', 2, [
    ['thinking', 'Folding {hole} to the re-raise was a bit tight. You needed about {need}% and had about {eq}%.']]);
  add('vs3bet.fold.strong.now', 1, [['surprised', 'You folded that?']]);
  add('vs3bet.fold.strong.why', 2, [
    ['thinking', '{hole} still wins about {eq}% against a re-raise. That’s strong enough to keep going.']]);
  add('vs3bet.call.good.why', 4, [['calm', 'Calling the re-raise with {hole} was fine. About {eq}%, needed {need}%.']]);
  add('vs3bet.call.close.why', 4, [['thinking', 'Calling the re-raise with {hole} was close. Fine.']]);
  add('vs3bet.call.weak.now', 1, [['wince', 'Calling a re-raise with that is expensive.'], ['thinking', 'That’s a lot to call with that.']]);
  add('vs3bet.call.weak.now.leans', 3, [['thinking', 'A loose call.']]);
  add('vs3bet.call.weak.why', 2, [
    ['thinking', 'A re-raise means a very strong range, about the top {range}%. {hole} wins about {eq}% against it. You needed {need}%.'],
    ['calm', 'Calling re-raises with hands like {hole} costs a lot over time. When you hit, they often hit better.']]);
  add('vs3bet.call.weak.why.leans', 2, [['thinking', 'Calling the re-raise with {hole} was a little loose. About {eq}% against {need}% needed.']]);
  add('vs3bet.call.value.now', 3, [['thinking', 'That was strong enough to raise again.']]);
  add('vs3bet.call.good.now', 4, [['calm', 'Called. Fine.'], ['calm', 'A fair call.']]);
  add('vs3bet.call.value.why', 2, [['calm', '{hole} was strong enough to raise again. You win about {eq}% even against a re-raise.']]);
  add('vs3bet.raise.value.now', 2, [['impressed', 'Raised again. Good.']]);
  add('vs3bet.raise.value.why', 2, [['pleased', 'Raising again with {hole} was right. About {eq}% against a re-raising range.']]);
  add('vs3bet.raise.close.why', 4, [['thinking', 'Raising again with {hole} was close.']]);
  add('vs3bet.raise.loose.now', 1, [['surprised', 'Raising again with that?']]);
  add('vs3bet.raise.loose.why', 2, [['thinking', 'Raising a re-raise with {hole} is too much. Against a range that strong, it wins about {eq}%.']]);

  /* ---------------- all in against a raise, with a deep stack ---------------- */
  add('reraise.shove.big.why', 2, [
    ['calm', 'All in with {hole} against a raise. Strong enough, but a normal re-raise gets more from the hands behind you.'],
    ['thinking', 'Shoving {hole} works, but with {bb} big blinds a smaller re-raise keeps worse hands in.']]);
  add('reraise.shove.big.now', 3, [['thinking', 'All in works. A normal re-raise might get more.'], ['calm', 'Strong enough. A bit much, though.']]);
  add('reraise.shove.loose.now', 1, [['surprised', 'All in with that?'], ['wince', 'That’s everything on a weak hand.']]);
  add('reraise.shove.loose.why', 2, [
    ['thinking', 'You went all in over a raise with {hole}, {bb} big blinds deep. The hands that call you win most of the time. About {eq}%.'],
    ['calm', 'All in with {hole} against a raise risks {bb} big blinds to win a few. The hands that call are better than yours.']]);

  /* ---------------- short stacks: shove or fold ---------------- */
  add('short.push.good.now', 2, [['pleased', 'Good shove.'], ['pleased', 'Right. All in is the play when you’re short.']]);
  add('short.push.good.why', 2, [
    ['calm', 'With {bb} big blinds, raising and folding wastes chips. All in with {hole} {seatFrom} is right. It’s inside the top {range}%.'],
    ['pleased', 'Short stack, first in: shove or fold. {hole} was a shove. Everyone else has to have a hand to call.']]);
  add('short.push.close.why', 4, [
    ['thinking', 'All in with {hole} on {bb} big blinds is close. Reasonable.'],
    ['calm', 'That shove with {hole} was on the edge. Fine.']]);
  add('short.push.loose.now', 1, [['wince', 'All in with that is loose.'], ['thinking', 'That’s a weak shove.']]);
  add('short.push.loose.now.leans', 3, [['thinking', 'A bit loose to shove.']]);
  add('short.push.loose.why', 2, [
    ['thinking', 'With {bb} big blinds {seatFrom}, a sound shove is about the top {range}%. {hole} is top {pct}%. Too loose.'],
    ['calm', 'Short stacks shove or fold. {hole} was a fold from there: too many players behind could wake up with a better hand.']]);
  add('short.push.loose.why.leans', 2, [['thinking', 'Shoving {hole} {seatFrom} with {bb} big blinds was a little loose. The range there is about the top {range}%.']]);
  add('short.fold.missed.now', 1, [['thinking', 'You’re short. That was a shove.'], ['surprised', 'That was good enough to go all in.']]);
  add('short.fold.missed.now.leans', 3, [['thinking', 'I’d have shoved that.']]);
  add('short.fold.missed.why', 2, [
    ['thinking', 'With {bb} big blinds, you can’t wait for a perfect hand: the blinds eat you. {hole} {seatFrom} is a shove. It’s inside the top {range}%.'],
    ['calm', 'Short-stacked, folding {hole} lets the blinds take your chips. All in wins the blinds often, and has a chance when called.']]);
  add('short.fold.missed.why.leans', 2, [['thinking', 'Folding {hole} on {bb} big blinds was a bit tight. It’s a shove from there.']]);
  add('short.fold.close.why', 4, [['calm', 'Folding {hole} short-stacked was close. Fine.']]);
  add('short.fold.good.why', 4, [['calm', 'Folding {hole} short was right. Wait for a shove.']]);
  add('short.raise.small.now', 3, [['thinking', 'When you’re that short, just go all in.']]);
  add('short.raise.small.why', 2, [
    ['calm', 'With {bb} big blinds, a normal raise commits most of your chips anyway. Going all in instead makes them fold more often.'],
    ['thinking', 'Right hand, wrong size. On {bb} big blinds, shove it rather than raising small.']]);
  add('short.limp.now', 1, [['wince', 'Limping when you’re short is a leak.'], ['thinking', 'Short stacks shove or fold.']]);
  add('short.limp.why', 2, [
    ['calm', 'With {bb} big blinds, calling the big blind wastes chips you can’t spare. Shove with good hands, fold the rest.'],
    ['thinking', 'Limping {hole} short gives everyone a cheap look. All in would have won the blinds, or got it in with a good hand.']]);
  add('short.flat.now', 3, [['thinking', 'When you’re short, shove it.']]);
  add('short.flat.why', 2, [['calm', 'Short-stacked, calling a raise leaves you too little to play with. {hole} wins about {eq}% here. Shove it instead.']]);
  add('short.reshove.good.now', 2, [['pleased', 'Good. All in.']]);
  add('short.reshove.good.why', 2, [['calm', 'All in over the raise with {hole} and {bb} big blinds was right. You win about {eq}% when called, and sometimes they fold.']]);

  /* ---------------- lessons: the first time one comes up ---------------- */
  add('lesson.starting-hands', 2, [
    ['calm', 'Most starting hands are folds. Good players play about one hand in five. The patience is the skill.'],
    ['calm', 'A lesson on starting hands: pairs, two high cards, and cards of the same suit next to each other are the ones worth playing.']]);
  add('lesson.position', 2, [
    ['calm', 'Position is where you sit against the button. Acting last is an advantage: you see what everyone does first. Play more hands late, fewer early.'],
    ['calm', 'The button acts last after the flop. The seats just before it are the cutoff and the hijack. The first to act is called under the gun.']]);
  add('lesson.raise-or-fold', 2, [
    ['calm', 'Raise or fold. Just calling the big blind is called limping. A raise can win the pot straight away. A call never can.'],
    ['calm', 'When nobody has raised, come in with a raise or don’t come in. It builds pots with your good hands and gives you the lead.']]);
  add('lesson.calling-raises', 2, [
    ['calm', 'A raise means a stronger hand. Calling raises with hands that only look good is the most common leak there is.'],
    ['calm', 'Against a raise, ask: what hands does this player raise with? Then: how often does my hand beat those? That’s your equity.']]);
  add('lesson.bb-defence', 2, [
    ['calm', 'In the big blind you’ve already put chips in, so calling a raise is cheaper. You can play more hands there than anywhere else, but not everything.'],
    ['calm', 'Pot odds: the price of a call against what you can win. If you need 25% and your hand wins 35% of the time, the call pays.']]);
  add('lesson.short-stack', 2, [
    ['calm', 'Under about ten big blinds, stop raising small. Shove or fold. All in makes others fold, and a small raise wastes chips you can’t spare.'],
    ['calm', 'Big blinds are how stacks are measured. Ten big blinds is short. The blinds cost you every round, so waiting too long is a mistake too.']]);
  add('lesson.three-bet', 2, [
    ['calm', 'A re-raise before the flop is called a three-bet. With a strong hand against one raise, it builds a pot while you’re ahead.'],
    ['calm', 'The first raise is an open. Raising again is a three-bet. It shows great strength, so it gets a lot of folds.']]);
  add('lesson.the-basics', 2, [
    ['calm', 'The big blind is a forced bet. If nobody raises, you can check and see the flop for free. Never fold when it’s free.']]);

  /* ---------------- again: the same mistake, not long after ----------------
     Short, so he doesn't give the same speech twice. By lesson. */
  add('again.raise-or-fold', 3, [
    ['thinking', 'Another limp. Raise or fold.'], ['calm', 'That’s a call again. Raise it or let it go.'],
    ['thinking', 'Limping again. Remember: raise or fold.'], ['calm', 'Same as before. A raise, or a fold.']]);
  add('again.position', 3, [
    ['thinking', 'Again, too loose for that seat.'], ['calm', 'Same thing: think about who’s still to act.'],
    ['thinking', 'Remember the seat. Early means tight.']]);
  add('again.starting-hands', 3, [
    ['thinking', 'Another good hand folded.'], ['calm', 'Too tight again. That one was worth playing.']]);
  add('again.calling-raises', 3, [
    ['thinking', 'Another call against a raise with a weak hand.'], ['calm', 'Same again: a raise means strength.'],
    ['thinking', 'Careful. Calling raises light again.']]);
  add('again.bb-defence', 3, [
    ['calm', 'Same as last time: in the big blind, the price is good.'], ['thinking', 'Remember the big blind’s discount.']]);
  add('again.short-stack', 3, [
    ['thinking', 'Short again. Shove or fold.'], ['calm', 'Same rule: short stacks shove or fold.']]);
  add('again.three-bet', 3, [
    ['thinking', 'Careful with those re-raises.'], ['calm', 'Same again: keep the three-bet for strong hands.']]);
  add('again.the-basics', 3, [
    ['thinking', 'Free again. Just check.']]);

  /* ---------------- lead-ins: the decision, not the result ---------------- */
  add('lead.wonAnyway', 2, [
    ['thinking', 'You won it, but that’s not the point.'], ['calm', 'You got lucky there.'], ['thinking', 'It worked this time.']]);
  add('lead.lostAnyway', 2, [
    ['unlucky', 'You lost, but the decision was right.'], ['calm', 'Lost the pot, not the argument.'], ['unlucky', 'Unlucky. You played it right.']]);

  return { lines:L };
})();
if (typeof window !== 'undefined') window.CoachLines = CoachLines;
