#!/usr/bin/env node
"use strict";

/* ============================================================
   PHASE 3 — SCORING AUDIT FIXTURE CASES
   ============================================================
   See scoring-fixtures.js for the determinism contract and the
   construction helpers. Every fixture below satisfies the board-length
   rule: no snapshot whose action is other than 'fold' or 'check' is
   taken with fewer than three board cards, so resolvedEquityAtSnapshot()
   always enumerates and never samples.

   `expected` is docs/scoring/SCORING_SPEC.md expressed as data.

   expected.awardPresentation:
     'breakdown'  - the reward breakdown and pot smash run (net-positive hand)
     'none'       - no reward layer at all (nothing earned, or net <= 0)
     'suppressed' - terminal hand: detection and score mutation still run,
                    presentation does not (SCORING_SPEC.md 3.5)
   ============================================================ */

const F = require('./scoring-fixtures.js');
const { expectedPotWinnings, expectedWinAward } = F;

/* Every fixture's expected score is DERIVED, never hand-typed, so the
   provisional BIG_WIN_BB/MASSIVE_WIN_BB constants can be retuned at
   Phase 4B in one place and the matrix stays coherent. */
function req(netProfit, bb, extras){
  const pw = expectedPotWinnings(netProfit, bb, 1);
  const win = expectedWinAward(netProfit, bb);
  const ids = [];
  let score = 0;
  if (pw > 0){ ids.push('potWinnings'); score += pw; }
  if (win){ ids.push(win.id); score += win.points; }
  (extras || []).forEach(x=>{ ids.push(x.id); score += x.points; });
  return { score, awardIds:ids };
}
const DOUBLE_UP  = { id:'doubleUp',   points:300 };
const KO         = { id:'ko',         points:400 };
const TABLE_CLEAR= { id:'tableClear', points:1000 };
const EVENT_WON  = { id:'eventWon',   points:1000 };
const MONSTER    = { id:'monsterHand',points:200 };

module.exports = [

/* ---------------------------------------------------------- F1 */
{
  id:'F1',
  title:'Correct call, wins showdown, net +40bb',
  purpose:'Baseline winning hand. Establishes that POT WINNINGS is already honest and that the decision award is pure addition.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:F.BOARD_TWO_PAIR,
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:1200, totalBetHand:800, hand:['K♥','J♦'] },
        { id:'ai1', name:'Wildcard', startStack:2000, chips:1200, totalBetHand:800, hand:['Q♠','9♥'] }
      ],
      snapshots:[{
        action:'call', street:'turn', board:F.BOARD_TURN_ONLY, hole:['K♥','J♦'],
        opponentIds:['ai1'], lastAggressorId:'ai1',
        pot:800, toCall:200, commit:200, stackBefore:1400, startStack:2000,
        totalCommittedBefore:600, bigBlind:20, equity:0.58, handActionIndex:4
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected: Object.assign({}, req(800, 20), { commentary:null, awardPresentation:'breakdown',
    notes:'Net +800 = 40bb, so MASSIVE WIN. The decision award contributes nothing.' })
},

/* ---------------------------------------------------------- F2 */
{
  id:'F2',
  title:'Correct call, loses showdown, survives',
  purpose:'FAILURE A in a non-terminal setting. Proves the decision award fires on a hand the player lost.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:F.BOARD_TWO_PAIR,
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:1200, totalBetHand:800, hand:['Q♠','9♥'] },
        { id:'ai1', name:'Wildcard', startStack:2000, chips:1200, totalBetHand:800, hand:['K♥','J♦'] }
      ],
      snapshots:[{
        action:'call', street:'turn', board:F.BOARD_TURN_ONLY, hole:['Q♠','9♥'],
        opponentIds:['ai1'], lastAggressorId:'ai1',
        pot:800, toCall:200, commit:200, stackBefore:1400, startStack:2000,
        totalCommittedBefore:600, bigBlind:20, equity:0.58, handActionIndex:4
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected:{ score:0, awardIds:[], commentary:null, awardPresentation:'none',
    notes:'A sound call that lost is Category C (SCORING_SPEC.md 3.1): no score and no V1 commentary.' }
},

/* ---------------------------------------------------------- F3 */
{
  id:'F3',
  title:'Bad call, wins by suck-out at showdown, net +25bb',
  purpose:'Category B luck tag ships unchanged when the cards were genuinely shown.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:['K♠','9♦','4♣','7♠','7♥'],
      players:[
        { id:'you', name:'You', isHuman:true, startStack:500, chips:0, totalBetHand:500, allIn:true, hand:['7♣','2♦'] },
        { id:'ai1', name:'Wildcard', startStack:500, chips:0, totalBetHand:500, allIn:true, hand:['A♠','A♥'] }
      ],
      snapshots:[{
        action:'call', street:'flop', board:F.BOARD_FLOP_ONLY, hole:['7♣','2♦'],
        opponentIds:['ai1'], lastAggressorId:'ai1',
        pot:500, toCall:500, commit:500, stackBefore:500, startStack:500,
        totalCommittedBefore:0, bigBlind:20, allIn:true, equity:0.18, handActionIndex:3
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:1, tableClear:true }, terminal:true };
  },
  expected: Object.assign({}, req(500, 20, [DOUBLE_UP, KO, TABLE_CLEAR]), {
    commentary:'luck:filthy', awardPresentation:'suppressed',
    notes:'Terminal winning hand: every objective component still scores exactly once, but the late carousel is suppressed. The luck tag is public - both hands reached showdown.' })
},

/* ---------------------------------------------------------- F4 */
{
  id:'F4',
  title:'Bad call, loses, survives',
  purpose:'Proves the negative catalogue is Category C and does not ship in V1.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:F.BOARD_TWO_PAIR,
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:1400, totalBetHand:600, hand:['7♣','3♦'] },
        { id:'ai1', name:'Wildcard', startStack:2000, chips:1400, totalBetHand:600, hand:['K♥','J♦'] }
      ],
      snapshots:[{
        action:'call', street:'turn', board:F.BOARD_TURN_ONLY, hole:['7♣','3♦'],
        opponentIds:['ai1'], lastAggressorId:'ai1',
        pot:600, toCall:600, commit:600, stackBefore:2000, startStack:2000,
        totalCommittedBefore:0, bigBlind:20, equity:0.20, handActionIndex:4
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected:{ score:0, awardIds:[], commentary:null, awardPresentation:'none',
    notes:'BAD CALL is a decision-quality verdict against a uniformly random range (D1). Not shipped in V1.' }
},

/* ---------------------------------------------------------- F5 */
{
  id:'F5',
  title:'Good fold, opponent shows better at showdown',
  purpose:'The fold family also fires on a hand the player took no part in winning.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:F.BOARD_TWO_PAIR,
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:1700, totalBetHand:300, folded:true, hand:['5♣','3♦'] },
        { id:'ai1', name:'Wildcard', startStack:2000, chips:1400, totalBetHand:600, hand:['K♥','J♦'] },
        { id:'ai2', name:'Doc', startStack:2000, chips:1400, totalBetHand:600, hand:['Q♠','9♥'] }
      ],
      snapshots:[{
        action:'fold', street:'turn', board:F.BOARD_TURN_ONLY, hole:['5♣','3♦'],
        opponentIds:['ai1','ai2'], lastAggressorId:'ai1',
        pot:900, toCall:600, commit:0, stackBefore:1700, startStack:2000,
        totalCommittedBefore:300, bigBlind:20, equity:0.22, handActionIndex:5
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected:{ score:0, awardIds:[], commentary:null, awardPresentation:'none',
    notes:'GOOD FOLD is Category C.' }
},

/* ---------------------------------------------------------- F6 */
{
  id:'F6',
  title:'Incorrect fold',
  purpose:'The negative fold verdict is Category C for the same reason as the positive one.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:F.BOARD_TWO_PAIR,
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:1800, totalBetHand:200, folded:true, hand:['K♦','9♠'] },
        { id:'ai1', name:'Wildcard', startStack:2000, chips:1500, totalBetHand:500, hand:['A♣','7♦'] },
        { id:'ai2', name:'Doc', startStack:2000, chips:1500, totalBetHand:500, hand:['Q♠','5♥'] }
      ],
      snapshots:[{
        action:'fold', street:'turn', board:F.BOARD_TURN_ONLY, hole:['K♦','9♠'],
        opponentIds:['ai1','ai2'], lastAggressorId:'ai1',
        pot:900, toCall:100, commit:0, stackBefore:1800, startStack:2000,
        totalCommittedBefore:200, bigBlind:20, equity:0.45, handActionIndex:5
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected:{ score:0, awardIds:[], commentary:null, awardPresentation:'none',
    notes:'BAD FOLD is Category C.' }
},

/* ---------------------------------------------------------- F7 */
{
  id:'F7',
  title:'Large fold-win with matched opponent contributions (S2), net +20bb',
  purpose:'DEFECT D7. A genuinely large fold-win can never fire a pot award today, because every layer excludes folded players from `eligible`.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:F.BOARD_TWO_PAIR, pot:700,
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:1700, totalBetHand:300, hand:['K♥','J♦'] },
        { id:'ai1', name:'Wildcard', startStack:2000, chips:1800, totalBetHand:200, folded:true, hand:['Q♠','9♥'] },
        { id:'ai2', name:'Doc', startStack:2000, chips:1800, totalBetHand:200, folded:true, hand:['7♣','3♦'] }
      ],
      snapshots:[{
        action:'raise', street:'river', board:F.BOARD_TWO_PAIR, hole:['K♥','J♦'],
        opponentIds:['ai1','ai2'], lastAggressorId:null,
        pot:400, toCall:0, commit:300, stackBefore:2000, startStack:2000,
        totalCommittedBefore:0, bigBlind:20, equity:0.78, handActionIndex:6
      }]
    });
    return { g, outcome:H.settleFoldWin(api, g, 'you'), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected: Object.assign({}, req(400, 20), { commentary:'pressureSucceeded', awardPresentation:'breakdown',
    notes:'Net +400 = 20bb, so BIG WIN. Commentary must not name or imply what was folded.' })
},

/* ---------------------------------------------------------- F8 */
{
  id:'F8',
  title:'Bluff called and lost at showdown',
  purpose:'The one bluff-shaped line that IS public: the human\'s own revealed holding.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:F.BOARD_TWO_PAIR,
      handActions:[
        { street:'river', id:'you', action:'bet' },
        { street:'river', id:'ai1', action:'call' }
      ],
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:1200, totalBetHand:800, hand:['5♣','3♦'] },
        { id:'ai1', name:'Wildcard', startStack:2000, chips:1200, totalBetHand:800, hand:['K♥','J♦'] }
      ],
      snapshots:[{
        action:'raise', street:'river', board:F.BOARD_TWO_PAIR, hole:['5♣','3♦'],
        opponentIds:['ai1'], lastAggressorId:null,
        pot:800, toCall:0, commit:600, stackBefore:1800, startStack:2000,
        totalCommittedBefore:200, bigBlind:20, equity:0.12, handActionIndex:0
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected:{ score:0, awardIds:[], commentary:'shownDownLight', awardPresentation:'none',
    notes:'The player\'s own cards were revealed at showdown, so describing them leaks nothing.' }
},

/* ---------------------------------------------------------- F9 */
{
  id:'F9',
  title:'Main pot 2,160 lost + contested side pot 40 won (S1), net -700',
  purpose:'FAILURE B, exactly as reported. Quads nines wins a $40 side pot while quads kings takes the $2,160 main pot.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:['K♠','K♦','9♣','9♦','4♣'],
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:1260, totalBetHand:740, hand:['9♠','9♥'] },
        { id:'ai1', name:'Wildcard', startStack:720, chips:0, totalBetHand:720, allIn:true, hand:['K♥','K♣'] },
        { id:'ai2', name:'Doc', startStack:2000, chips:1260, totalBetHand:740, hand:['A♠','A♦'] }
      ],
      snapshots:[{
        action:'call', street:'turn', board:['K♠','K♦','9♣','9♦'], hole:['9♠','9♥'],
        opponentIds:['ai1','ai2'], lastAggressorId:'ai2',
        pot:1200, toCall:500, commit:500, stackBefore:1760, startStack:2000,
        totalCommittedBefore:240, bigBlind:20, equity:0.62, handActionIndex:5
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected:{ score:0, awardIds:[], commentary:'sidePotWonNetLoss', awardPresentation:'none',
    notes:'Net -700. No pot award, no MONSTER HAND, no reward breakdown, no pot smash. The pot is still paid visually; only the reward layer is silent.' }
},

/* ---------------------------------------------------------- F10 */
{
  id:'F10',
  title:'Genuine large net win (S5), net +25bb',
  purpose:'The case a corrected BIG WIN must still fire on.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:['A♥','7♦','2♣','5♠','8♦'],
      handActions:[
        { street:'flop', id:'you', action:'raise' },
        { street:'flop', id:'ai1', action:'call' }
      ],
      players:[
        { id:'you', name:'You', isHuman:true, startStack:500, chips:0, totalBetHand:500, allIn:true, hand:['A♠','A♦'] },
        { id:'ai1', name:'Wildcard', startStack:2000, chips:1500, totalBetHand:500, tightness:0.5, hand:['K♥','K♣'] }
      ],
      snapshots:[{
        action:'raise', street:'flop', board:['A♥','7♦','2♣'], hole:['A♠','A♦'],
        opponentIds:['ai1'], lastAggressorId:null,
        pot:200, toCall:0, commit:500, stackBefore:500, startStack:500,
        totalCommittedBefore:0, bigBlind:20, allIn:true, equity:0.88, handActionIndex:0
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected: Object.assign({}, req(500, 20, [DOUBLE_UP]), { commentary:null, awardPresentation:'breakdown',
    notes:'Net +500 = 25bb, so BIG WIN rather than MASSIVE WIN. Under the current whole-table rule this same hand reads as a 50bb pot.' })
},

/* ---------------------------------------------------------- F11 */
{
  id:'F11',
  title:'Exact chop of an 800 pot (S3), net 0',
  purpose:'A break-even chop must not read as a major win.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:['10♠','J♦','Q♣','K♥','A♠'],
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:1600, totalBetHand:400, hand:['3♣','4♦'] },
        { id:'ai1', name:'Wildcard', startStack:2000, chips:1600, totalBetHand:400, hand:['5♥','6♠'] }
      ],
      snapshots:[{
        action:'call', street:'turn', board:['10♠','J♦','Q♣','K♥'], hole:['3♣','4♦'],
        opponentIds:['ai1'], lastAggressorId:'ai1',
        pot:600, toCall:100, commit:100, stackBefore:1700, startStack:2000,
        totalCommittedBefore:300, bigBlind:20, equity:0.50, handActionIndex:4
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected:{ score:0, awardIds:[], commentary:'potChopped', awardPresentation:'none',
    notes:'Board plays; both players chop. Net 0, so nothing scores.' }
},

/* ---------------------------------------------------------- F12 */
{
  id:'F12',
  title:'All-in bust after a sound call — the reported defeat sequence',
  purpose:'FAILURE A, terminal. A correct-price call loses, the player busts, and a celebratory award is presented before RUN OVER.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:['K♠','9♠','4♣','2♥','3♦'],
      players:[
        { id:'you', name:'You', isHuman:true, startStack:800, chips:0, totalBetHand:800, allIn:true, hand:['Q♠','J♠'] },
        { id:'ai1', name:'Wildcard', startStack:2000, chips:1200, totalBetHand:800, hand:['K♥','K♦'] }
      ],
      snapshots:[{
        action:'call', street:'flop', board:['K♠','9♠','4♣'], hole:['Q♠','J♠'],
        opponentIds:['ai1'], lastAggressorId:'ai1',
        pot:900, toCall:800, commit:800, stackBefore:800, startStack:800,
        totalCommittedBefore:0, bigBlind:20, allIn:true, equity:0.62, handActionIndex:3
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:0, tableClear:false }, terminal:true, terminalKind:'bust' };
  },
  expected:{ score:0, awardIds:[], commentary:null, awardPresentation:'suppressed',
    notes:'Nothing may be presented between the bust and RUN OVER. Detection and mutation still run; they simply find nothing.' }
},

/* ---------------------------------------------------------- F13 */
{
  id:'F13',
  title:'Terminal winning hand with several objective components (Single Player)',
  purpose:'Every earned point must reach the total exactly once, with no award carousel before TABLE CLEARED.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:['A♥','7♦','2♣','5♠','8♦'],
      handActions:[
        { street:'flop', id:'you', action:'raise' },
        { street:'flop', id:'ai1', action:'call' }
      ],
      players:[
        { id:'you', name:'You', isHuman:true, startStack:500, chips:0, totalBetHand:500, allIn:true, hand:['A♠','A♦'] },
        { id:'ai1', name:'Wildcard', startStack:500, chips:0, totalBetHand:500, allIn:true, tightness:0.5, hand:['K♥','K♣'] }
      ],
      snapshots:[{
        action:'raise', street:'flop', board:['A♥','7♦','2♣'], hole:['A♠','A♦'],
        opponentIds:['ai1'], lastAggressorId:null,
        pot:200, toCall:0, commit:500, stackBefore:500, startStack:500,
        totalCommittedBefore:0, bigBlind:20, allIn:true, equity:0.88, handActionIndex:0
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:null, resolveEliminations:true,
             terminal:true, terminalKind:'tableClear' };
  },
  expected: Object.assign({}, req(500, 20, [DOUBLE_UP, KO, TABLE_CLEAR]), {
    commentary:null, awardPresentation:'suppressed',
    notes:'The early pot-smash for the hand\'s own payout is retained; only the late K.O./TABLE CLEARED carousel is suppressed, with its points folded into the result stage.' })
},

/* ---------------------------------------------------------- F14 */
{
  id:'F14',
  title:'Career event settlement, first place',
  purpose:'DEFECT D5 and D6. Career must fire K.O. and must not print the literal award name TABLE CLEARED.',
  build(api, H){
    const g = H.table(api, {
      mode:'career', bigBlind:20, phase:'river', board:['A♥','7♦','2♣','5♠','8♦'],
      eventName:'BACK ROOM FREEZEOUT', buyIn:100, playerCount:3, payouts:[300],
      handActions:[
        { street:'flop', id:'you', action:'raise' },
        { street:'flop', id:'ai1', action:'call' }
      ],
      players:[
        { id:'you', name:'You', isHuman:true, startStack:500, chips:0, totalBetHand:500, allIn:true, hand:['A♠','A♦'] },
        { id:'ai1', name:'Wildcard', startStack:500, chips:0, totalBetHand:500, allIn:true, tightness:0.5, hand:['K♥','K♣'] }
      ],
      snapshots:[{
        action:'raise', street:'flop', board:['A♥','7♦','2♣'], hole:['A♠','A♦'],
        opponentIds:['ai1'], lastAggressorId:null,
        pot:200, toCall:0, commit:500, stackBefore:500, startStack:500,
        totalCommittedBefore:0, bigBlind:20, allIn:true, equity:0.88, handActionIndex:0
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:null, resolveEliminations:true,
             terminal:true, terminalKind:'eventWon', assertNoArcadeWrite:true };
  },
  expected: Object.assign({}, req(500, 20, [DOUBLE_UP, KO, EVENT_WON]), {
    commentary:null, awardPresentation:'suppressed',
    notes:'K.O. must fire in Career (D5). The 1,000-point terminal award must carry the id eventWon, not tableClear (D6). felt.arcade must be untouched.' })
},

/* ---------------------------------------------------------- F15 */
{
  id:'F15',
  title:'Single Player run termination — high score written after the bust hand',
  purpose:'Whether a bust-hand decision award reaches the PERSISTED high score.',
  reuse:'F12',
  finalizeRun:true,
  expected:{ score:0, awardIds:[], commentary:null, awardPresentation:'suppressed',
    notes:'finalizeArcadeRun() runs after mutation, so any point awarded on the bust hand is permanently recorded in felt.arcade.highScore.' }
},

/* ---------------------------------------------------------- F16 */
{
  id:'F16',
  title:'Career evaluation writes nothing to felt.arcade',
  purpose:'Confirms the arcadePersists() boundary holds - the one guarantee CAREER_DESIGN.md already claims.',
  reuse:'F14',
  assertNoArcadeWrite:true,
  expected:{ score:null, awardIds:null, commentary:null, awardPresentation:null,
    notes:'Scored channels are not compared here; the assertion is that highScore, counts, discovered and bestByEvent are byte-identical before and after.' }
},

/* ---------------------------------------------------------- F17 */
{
  id:'F17',
  title:'River fold-win where the human folded earlier',
  purpose:'DEFECT D9. foldSnapshotNote() describes the fold-win winner\'s never-shown hole cards.',
  reviewLeak:true,
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:F.BOARD_TWO_PAIR, pot:700,
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:1800, totalBetHand:200, folded:true, hand:['K♦','9♠'] },
        { id:'ai1', name:'Wildcard', startStack:2000, chips:1500, totalBetHand:500, hand:['K♥','J♦'] },
        { id:'ai2', name:'Doc', startStack:2000, chips:1700, totalBetHand:300, folded:true, hand:['Q♠','5♥'] }
      ],
      humanFoldSnapshot:{ street:'flop', holeCards:['K♦','9♠'] }
    });
    g.humanFoldSnapshot.holeCards = H.makeCards(api, ['K♦','9♠']);
    return { g, outcome:H.settleFoldWin(api, g, 'ai1'), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected:{ score:0, awardIds:[], commentary:null, awardPresentation:'none', reviewNoteMustBeNull:true,
    notes:'A fold-win reveals nothing. The review note must not describe the winner\'s hand.' }
},

/* ---------------------------------------------------------- F18 */
{
  id:'F18',
  title:'Five consecutive hands each eligible for a soft commentary line',
  purpose:'There is no cadence limiter today; every eligible hand presents.',
  repeatOf:'F7',
  repeatCount:5,
  expected:{ maxCommentaryLines:2, awardPresentation:null,
    notes:'SCORING_SPEC.md 3.4: soft lines fire at most once every N hands, working default N = 4, so five eligible hands may emit at most two lines.' }
},

/* ---------------------------------------------------------- F19 */
{
  id:'F19',
  title:'Huge gross collection, tiny net profit (S4), net +6bb',
  purpose:'Gross collected 1,120 (56bb) against a net of 120 (6bb). A pot award must not fire.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:['K♠','9♦','4♣','J♥','2♠'],
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:1000, totalBetHand:1000, hand:['K♥','J♦'] },
        { id:'ai1', name:'Wildcard', startStack:120, chips:0, totalBetHand:120, allIn:true, hand:['Q♠','9♥'] }
      ],
      snapshots:[{
        action:'raise', street:'turn', board:F.BOARD_TURN_ONLY, hole:['K♥','J♦'],
        opponentIds:['ai1'], lastAggressorId:null,
        pot:240, toCall:0, commit:880, stackBefore:1880, startStack:2000,
        totalCommittedBefore:120, bigBlind:20, equity:0.86, handActionIndex:4
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:1, tableClear:true }, terminal:true, terminalKind:'tableClear' };
  },
  expected: Object.assign({}, req(120, 20, [KO, TABLE_CLEAR]), { commentary:null, awardPresentation:'suppressed',
    notes:'Net +120 = 6bb, below BIG_WIN_BB. The 880 that came back was never matched by anyone.' })
},

/* ---------------------------------------------------------- F20 */
{
  id:'F20',
  title:'Net-positive contested side-pot result, net +20bb',
  purpose:'A side-pot win the player genuinely profited from must still score.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:['K♠','K♦','9♣','9♦','4♣'],
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:1200, totalBetHand:800, hand:['9♠','9♥'] },
        { id:'ai1', name:'Wildcard', startStack:200, chips:0, totalBetHand:200, allIn:true, hand:['K♥','K♣'] },
        { id:'ai2', name:'Doc', startStack:2000, chips:1200, totalBetHand:800, hand:['A♠','A♦'] }
      ],
      snapshots:[{
        action:'call', street:'turn', board:['K♠','K♦','9♣','9♦'], hole:['9♠','9♥'],
        opponentIds:['ai1','ai2'], lastAggressorId:'ai2',
        pot:1200, toCall:300, commit:300, stackBefore:1500, startStack:2000,
        totalCommittedBefore:500, bigBlind:20, equity:0.62, handActionIndex:5
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:1, tableClear:false }, terminal:false };
  },
  expected: Object.assign({}, req(400, 20, [KO, MONSTER]), { commentary:null, awardPresentation:'breakdown',
    notes:'Net +400 = 20bb, so BIG WIN. Quads shown at showdown, so MONSTER HAND is public and net-positive.' })
},

/* ---------------------------------------------------------- F21 */
{
  id:'F21',
  title:'Net-negative contested side-pot result at smaller scale, net -18bb',
  purpose:'F9\'s twin. The same defect must not survive a change of scale.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:['K♠','K♦','9♣','9♦','4♣'],
      players:[
        { id:'you', name:'You', isHuman:true, startStack:1000, chips:600, totalBetHand:400, hand:['9♠','9♥'] },
        { id:'ai1', name:'Wildcard', startStack:380, chips:0, totalBetHand:380, allIn:true, hand:['K♥','K♣'] },
        { id:'ai2', name:'Doc', startStack:1000, chips:600, totalBetHand:400, hand:['A♠','A♦'] }
      ],
      snapshots:[{
        action:'call', street:'turn', board:['K♠','K♦','9♣','9♦'], hole:['9♠','9♥'],
        opponentIds:['ai1','ai2'], lastAggressorId:'ai2',
        pot:700, toCall:200, commit:200, stackBefore:800, startStack:1000,
        totalCommittedBefore:200, bigBlind:20, equity:0.62, handActionIndex:5
      }]
    });
    return { g, outcome:H.settleShowdown(api, g), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected:{ score:0, awardIds:[], commentary:'sidePotWonNetLoss', awardPresentation:'none',
    notes:'Net -360. Same shape as F9 at a fifth of the size.' }
},

/* ---------------------------------------------------------- F22 */
{
  id:'F22',
  title:'Uncalled shove returned, net +1.5bb',
  purpose:'Proves the player\'s own money is never counted, and is the counterpart F26 pairs against F9.',
  build(api, H){
    const g = H.table(api, {
      bigBlind:20, phase:'river', board:F.BOARD_FLOP_ONLY, pot:2030,
      players:[
        { id:'you', name:'You', isHuman:true, startStack:2000, chips:0, totalBetHand:2000, allIn:true, hand:['A♠','K♠'] },
        { id:'ai1', name:'Wildcard', startStack:2000, chips:1980, totalBetHand:20, folded:true, hand:['Q♦','9♥'] },
        { id:'ai2', name:'Doc', startStack:2000, chips:1990, totalBetHand:10, folded:true, hand:['7♣','3♦'] }
      ],
      snapshots:[{
        action:'raise', street:'flop', board:F.BOARD_FLOP_ONLY, hole:['A♠','K♠'],
        opponentIds:['ai1'], lastAggressorId:null,
        pot:50, toCall:0, commit:1980, stackBefore:1980, startStack:2000,
        totalCommittedBefore:20, bigBlind:20, allIn:true, equity:0.80, handActionIndex:2
      }]
    });
    return { g, outcome:H.settleFoldWin(api, g, 'you'), context:{ koCount:0, tableClear:false }, terminal:false };
  },
  expected: Object.assign({}, req(30, 20), { commentary:'uncalledBetReturned', awardPresentation:'breakdown',
    notes:'1,980 of the 2,030 collected was the player\'s own unmatched bet. Net +30 = 1.5bb, so no win award.' })
},

/* ---------------------------------------------------------- F23 */
{
  id:'F23',
  title:'Hidden cards changed, every visible fact identical',
  purpose:'DEFECT D10. The leakage guard: same board, same hole cards, same actions, same settlement - only the folded opponents\' cards differ.',
  leakPair:true,
  build(api, H){
    const mk = (aiCards, ai2Cards)=>{
      const g = H.table(api, {
        bigBlind:20, phase:'river', board:F.BOARD_FLOP_ONLY, pot:1400,
        players:[
          { id:'you', name:'You', isHuman:true, startStack:1000, chips:0, totalBetHand:1000, allIn:true, hand:['6♦','5♦'] },
          { id:'ai1', name:'Wildcard', startStack:1000, chips:800, totalBetHand:200, folded:true, hand:aiCards },
          { id:'ai2', name:'Doc', startStack:1000, chips:800, totalBetHand:200, folded:true, hand:ai2Cards }
        ],
        snapshots:[{
          action:'raise', street:'flop', board:F.BOARD_FLOP_ONLY, hole:['6♦','5♦'],
          opponentIds:['ai1','ai2'], lastAggressorId:null,
          pot:400, toCall:0, commit:800, stackBefore:800, startStack:1000,
          totalCommittedBefore:200, bigBlind:20, allIn:true, equity:0.30, handActionIndex:2
        }]
      });
      return { g, outcome:H.settleFoldWin(api, g, 'you'), context:{ koCount:0, tableClear:false }, terminal:false };
    };
    return {
      variantA:mk(['2♥','3♠'], ['7♥','8♠']),   // folded opponents held nothing
      variantB:mk(['K♥','K♣'], ['A♥','A♣'])    // folded opponents held monsters
    };
  },
  expected:{ identicalAcrossVariants:true,
    notes:'Neither variant changes one thing the player can see. Any difference in emitted output is a leak, including a difference in whether a message appears at all.' }
},

/* ---------------------------------------------------------- F24 */
{
  id:'F24',
  title:'Lifetime statistic predicates across five settled hands',
  purpose:'DEFECT D13 and D14, plus the hand-won definition.',
  statsAudit:['F9','F11','F19','F20','F22'],
  expected:{
    notes:'Required: a hand is won only when netProfit > 0; an exact chop is not a win; biggestPot and run.biggestPotWon record net profit, not the table pot and not the gross share.'
  }
},

/* ---------------------------------------------------------- F25 */
{
  id:'F25',
  title:'Player-facing statistic labels',
  purpose:'A redefined statistic must not keep a gross-pot label on screen.',
  /* `legacy` is the gross-pot copy that must be GONE; `required` is the
     approved replacement that must be PRESENT. Both harnesses check both
     directions, so this fixture cannot pass by the label simply having
     been deleted, nor by the new label being added alongside the old. */
  labelAudit:[
    { file:'js/07-ui-wiring.js',   legacy:"{k:'Best pot'",        required:"{k:'Best hand win'",       what:'stat strip and settings statistics' },
    { file:'js/05-game-engine.js', legacy:"{label:'Biggest pot'", required:"{label:'Biggest net win'", what:'TABLE CLEARED recap and RUN OVER recap' },
    { file:'validation/career-result-checks.js', legacy:"'Biggest pot',", required:"'Biggest net win'", what:'two existing assertions that pin the copy' }
  ],
  expected:{ notes:'The copy change ships in the same gate as the meaning change (Phase 4A).' }
},

/* ---------------------------------------------------------- F26 */
{
  id:'F26',
  title:'Contested versus uncalled, side by side',
  purpose:'Demonstrates that computePots() discards payers.length, so F9 and F22 cannot currently be told apart.',
  distinguishPair:['F9','F22'],
  expected:{ notes:'SCORING_SPEC.md 3.3: telling SIDE POT WON from UNCALLED BET RETURNED needs the contributor count, which computePots() computes and then throws away.' }
}

];
