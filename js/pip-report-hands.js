"use strict";

/* ============================================================
   P.I.P. REPORT LAB — the example hands (lab only)

   Seven hands built by hand in the shape CoachReport.build() takes, so the
   owner can see the report on every kind of ending. In the game the same
   shape comes from CoachBrain's hand record: each decision's verdict and
   confidence from judge(), "know" (your chance as you could know it)
   from the equity the brain samples at each decision, the reads from
   stories(). Here those are written to match what P.I.P. would say; the
   TRUTH (your chance against the cards they showed) is worked out by the
   report itself from the real cards.

   Every hand: big blind 20, stacks of 1,000 (the all in: 240). Pots and
   "yourIn" are running totals at the end of each street, and add up.
   Opponents are named from the table at the time: {A} is the first
   opponent, {B} the second.
   ============================================================ */
const PIP_REPORT_HANDS = (() => {
  const SUIT = { s:'♠', h:'♥', d:'♦', c:'♣' };
  const VAL = { 2:2, 3:3, 4:4, 5:5, 6:6, 7:7, 8:8, 9:9, T:10, J:11, Q:12, K:13, A:14 };
  const C = s => { const r = s[0] === 'T' ? '10' : s[0]; return { rank:r, suit:SUIT[s[1]], value:VAL[s[0]] }; };
  const cs = str => str.split(' ').map(C);

  return [
    { id:'beaten', title:'BEATEN ON THE RIVER', sub:'Played right, lost anyway.', who:'A',
      n:47, net:-620, ended:'showdown', endStreet:'river',
      hole:cs('As Ks'), board:cs('Kh 9d 4c 7h 8s'), shownBy:'A', shown:[cs('Jd Td')],
      streets:{
        preflop:{ pot:150, yourIn:60, you:[{ act:'raised to 60', verdict:'good', confidence:'clear', potBB:2.5, risk:0.06 }],
          them:'called 20, then 60', read:'LOOSE', know:0.62,
          note:'Ace-king of one suit, and {A} only called. Raising was right: it grows the pot while you\'re likely ahead.' },
        flop:{ pot:310, yourIn:140, you:[{ act:'bet 80', verdict:'good', confidence:'clear', potBB:7.5, risk:0.08 }],
          them:'checked, called', read:'CALLING', know:0.8, figs:{ eq:80 },
          note:'A pair of kings with an ace beside them. Betting was right: plenty of worse hands call.' },
        turn:{ pot:670, yourIn:320, you:[{ act:'bet 180', verdict:'good', confidence:'leans', potBB:15.5, risk:0.19 }],
          them:'checked, called', read:'CALLING', know:0.72, figs:{ eq:72 },
          note:'Still ahead of most hands that keep calling. Betting again made their hopeful hands pay to see the river.' },
        river:{ pot:1270, yourIn:620, you:[{ act:'called 300', verdict:'good', confidence:'leans', potBB:33.5, risk:0.44 }],
          them:'bet 300', read:'STRONG', know:0.38, figs:{ eq:38, need:24 },
          note:'The 8 finished a straight, and {A} bet for the first time. You were behind more often than not, but a call only had to win one time in four. Close, and right.' }
      },
      summary:'You played every street right. {A} called with a hand that needed help, and the river gave it a straight. That was the cards, not you.',
      takeaway:'When a player who has only called suddenly bets on the last card, believe them more often.' },

    { id:'lucky', title:'A LUCKY ESCAPE', sub:'Won it, but a call was a clear mistake.', who:'B',
      n:52, net:620, ended:'showdown', endStreet:'river',
      hole:cs('7c 7d'), board:cs('Kd 9h 4s As 7h'), shownBy:'B', shown:[cs('Ac Qd')],
      streets:{
        preflop:{ pot:150, yourIn:60, you:[{ act:'called 60', verdict:'fine', confidence:'leans', potBB:4, risk:0.06 }],
          them:'raised to 60', read:'STRONG', know:0.45,
          note:'Calling a raise with a small pair is fine when you act after them. You\'re hoping for a third seven.' },
        flop:{ pot:310, yourIn:140, you:[{ act:'called 80', verdict:'fine', confidence:'close', potBB:7.5, risk:0.08 }],
          them:'bet 80', read:'BET AGAIN', know:0.38, figs:{ eq:38, need:26 },
          note:'A king and a nine, both above your sevens. Calling once to see what {B} does next was close.' },
        turn:{ pot:710, yourIn:340, you:[{ act:'called 200', verdict:'mistake', confidence:'clear', potBB:15.5, risk:0.23 }],
          them:'bet 200', read:'STRONG', know:0.12, figs:{ eq:12, need:28 },
          note:'An ace came and {B} bet big again. Three cards above you, and only two sevens left to save you. This was the time to fold.' },
        river:{ pot:1210, yourIn:590, you:[{ act:'bet 250', verdict:'good', confidence:'leans', potBB:35.5, risk:0.38 }],
          them:'checked, called', read:'CALLING', know:0.9, figs:{ eq:90 },
          note:'The third seven! Betting was right: {B} had shown a big hand and would pay you.' }
      },
      summary:'You won, but the turn call was a clear mistake. You needed one of two cards, and it came. Most times that call just costs you 200.',
      takeaway:'Pay to chase only when the price is small next to what you could win.' },

    { id:'bluff', title:'THE BLUFF', sub:'Won it without the best cards. Theirs never shown.', who:'A',
      n:31, net:110, ended:'foldwin', endStreet:'turn',
      hole:cs('Qs Js'), board:cs('8h 5c 2d Kc'), shown:null,
      streets:{
        preflop:{ pot:110, yourIn:50, you:[{ act:'raised to 50', verdict:'good', confidence:'clear', potBB:1.5, risk:0.05 }],
          them:'called 50', read:'CALLED', know:0.55,
          note:'Queen-jack of one suit, with only the blinds left to act. A good hand to raise with.' },
        flop:{ pot:210, yourIn:100, you:[{ act:'bet 50', verdict:'good', confidence:'leans', notable:true, potBB:5.5, risk:0.05 }],
          them:'checked, called', read:'UNSURE', know:0.4, figs:{ eq:40 },
          note:'You missed, but these cards miss most hands. One player, who checked to you: a small bet was a fair try.' },
        turn:{ pot:330, yourIn:220, you:[{ act:'bet 120', verdict:'good', confidence:'leans', potBB:10.5, risk:0.13 }],
          them:'checked, folded', read:'WEAK', know:0.42, figs:{ eq:42 },
          note:'A king is a card you could easily hold. {A} checked twice, so betting again told your story, and they let it go.' }
      },
      summary:'You won without the best cards, and that\'s fine. {A} showed weakness twice and you bet both times. Their cards were never shown, so I can\'t say what you beat.',
      takeaway:'A bet works best against one player who keeps checking.' },

    { id:'allin', title:'ALL IN, CARDS RUN', sub:'All in before the flop. No more decisions.', who:'B',
      n:88, net:250, ended:'showdown', endStreet:'river',
      hole:cs('Ad Kc'), board:cs('Qs 9c 2h Kh 4s'), shownBy:'B', shown:[cs('8s 8d')],
      streets:{
        preflop:{ pot:490, yourIn:240, you:[{ act:'all in 240', verdict:'good', confidence:'clear', notable:true, potBB:1.5, risk:1 }],
          them:'called', read:'CALLED', know:0.52, figs:{ eq:52 },
          note:'Only 240 chips left and ace-king: all in is right. Most hands fold, and when called you\'re rarely far behind.' },
        flop:{ pot:490, yourIn:240, you:[], youNote:'all in',
          note:'Their eights still ahead. You needed an ace or a king, or a straight.' },
        turn:{ pot:490, yourIn:240, you:[], youNote:'all in',
          note:'A king! Now you\'re ahead.' },
        river:{ pot:490, yourIn:240, you:[], youNote:'all in',
          note:'And it held.' }
      },
      summary:'All in with ace-king and few chips left is right every time. You were behind their eights until the king came. Sometimes it won\'t come.',
      takeaway:'Short on chips? All in or fold, with strong cards.' },

    { id:'fold', title:'THE FOLD', sub:'Lost a little, saved the rest.', who:'A',
      n:63, net:-180, ended:'folded', endStreet:'flop',
      hole:cs('9h 9c'), board:cs('Ac Kh 4d'), shown:null,
      streets:{
        preflop:{ pot:390, yourIn:180, you:[
            { act:'raised to 60', verdict:'good', confidence:'clear', potBB:1.5, risk:0.06 },
            { act:'called 180', verdict:'fine', confidence:'close', potBB:13.5, risk:0.13 }],
          them:'raised to 180', read:'STRONG', know:0.44, figs:{ eq:44, need:31 },
          note:'Raising nines was right. Calling {A}\'s bigger raise was close: folding was fine too.' },
        flop:{ pot:590, yourIn:180, you:[{ act:'folded', verdict:'good', confidence:'clear', potBB:29.5, risk:0.24 }],
          them:'bet 200', read:'STRONG', know:0.14, figs:{ eq:14, need:25 },
          note:'An ace and a king, after {A} raised big. Your nines were almost always behind. Folding saved 200.' }
      },
      summary:'Good fold. One close call before the flop, then you let it go when big cards came.',
      takeaway:'When two high cards come and the player who raised big bets, a small pair should usually fold.' },

    { id:'thin', title:'LEFT CHIPS BEHIND', sub:'Won it, but could have won more.', who:'B',
      n:74, net:230, ended:'showdown', endStreet:'river',
      hole:cs('Ah 9h'), board:cs('Ac 9d 3s 2c Kh'), shownBy:'B', shown:[cs('Ad 5c')],
      streets:{
        preflop:{ pot:130, yourIn:60, you:[{ act:'raised to 60', verdict:'good', confidence:'clear', potBB:1.5, risk:0.06 }],
          them:'called 60', read:'CALLED', know:0.58,
          note:'An ace with a nine of the same suit. Raising was right.' },
        flop:{ pot:270, yourIn:130, you:[{ act:'bet 70', verdict:'good', confidence:'clear', potBB:6.5, risk:0.07 }],
          them:'checked, called', read:'CALLING', know:0.86, figs:{ eq:86 },
          note:'Aces and nines, two pairs. Betting was right.' },
        turn:{ pot:270, yourIn:130, you:[{ act:'checked', verdict:'mistake', confidence:'leans', potBB:13.5, risk:0 }],
          them:'checked', read:'CALLING', know:0.86, figs:{ eq:86 },
          note:'Two pairs, and {B} checked to you again. Checking let the hand slow down. Bet here: they had shown they would call.' },
        river:{ pot:450, yourIn:220, you:[{ act:'bet 90', verdict:'mistake', confidence:'close', potBB:13.5, risk:0.1 }],
          them:'checked, called', read:'CALLING', know:0.88, figs:{ eq:88 },
          note:'A bet was right, but small for two pairs. {B} had called before and would have called more.' }
      },
      summary:'You won, but you left chips behind. With two pairs you checked the turn and bet small on the river. {B} had an ace and would have paid more.',
      takeaway:'When you\'re well ahead, bet. Checking gives away chips you would have won.' },

    { id:'small', title:'A SMALL HAND', sub:'Folded before the flop. Nothing to report.', who:'A',
      n:90, net:0, ended:'folded', endStreet:'preflop',
      hole:cs('9c 4d'), board:[], shown:null,
      streets:{
        preflop:{ pot:0, yourIn:0, you:[{ act:'folded', verdict:'good', confidence:'clear', potBB:1.5, risk:0 }] }
      },
      summary:'', takeaway:'' }
  ];
})();
if (typeof window !== 'undefined') window.PIP_REPORT_HANDS = PIP_REPORT_HANDS;
if (typeof module !== 'undefined') module.exports = PIP_REPORT_HANDS;
