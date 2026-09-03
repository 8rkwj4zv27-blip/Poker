"use strict";

/* ============================================================
   SHOWDOWN RAIL MODEL — pure prototype data.

   evaluate7WithCards(), compareHands(), describeMade() and cardKey() are the
   production poker helpers from 01-poker-math.js. This file never evaluates a
   hand independently; it only orders and classifies the exact five that the
   production evaluator returned, then records where those cards came from.
   ============================================================ */

function showdownRailCard(code){
  const suit=code.slice(-1), rank=code.slice(0,-1);
  if (!Object.prototype.hasOwnProperty.call(RANK_VALUES,rank) || !SUITS.includes(suit)){
    throw new Error('Invalid showdown rail card: '+code);
  }
  return {rank,suit,value:RANK_VALUES[rank]};
}

function showdownRailOrder(cat,cards){
  const out=cards.slice();
  if (cat===4 || cat===8 || cat===9){
    const wheel=out.some(c=>c.value===14) && out.some(c=>c.value===5)
      && out.some(c=>c.value===4) && out.some(c=>c.value===3) && out.some(c=>c.value===2);
    return out.sort((a,b)=>{
      const av=wheel&&a.value===14?1:a.value, bv=wheel&&b.value===14?1:b.value;
      return bv-av;
    });
  }
  if (cat===0 || cat===5) return out.sort((a,b)=>b.value-a.value);
  const counts={};
  out.forEach(c=>{ counts[c.value]=(counts[c.value]||0)+1; });
  return out.sort((a,b)=>counts[b.value]-counts[a.value] || b.value-a.value);
}

function showdownRailTreatments(cat,tiebreak,cards){
  const strong=new Set();
  if ([4,5,6,8,9].includes(cat)) cards.forEach(c=>strong.add(cardKey(c)));
  else if ([1,3,7].includes(cat)) cards.forEach(c=>{ if (c.value===tiebreak[0]) strong.add(cardKey(c)); });
  else if (cat===2) cards.forEach(c=>{
    if (c.value===tiebreak[0] || c.value===tiebreak[1]) strong.add(cardKey(c));
  });
  else if (cards.length){
    const lead=cards.reduce((best,c)=>!best||c.value>best.value?c:best,null);
    strong.add(cardKey(lead));
  }
  return cards.map(c=>strong.has(cardKey(c))?'strong':'support');
}

function showdownRailWinnerLabel(players,winnerIds){
  const winners=winnerIds.map(id=>players.find(p=>p.id===id)).filter(Boolean);
  if (winners.length>1) return winners.map(p=>p.id==='you'?'YOU':p.name.toUpperCase()).join(' + ')+' SPLIT';
  if (!winners.length) return 'NO WINNER';
  return winners[0].id==='you'?'YOU WIN':winners[0].name.toUpperCase()+' WINS';
}

function showdownRailEvaluatePlayer(fixture,player){
  const cards=player.hole.concat(fixture.board);
  const evaluated=evaluate7WithCards(cards);
  const ordered=showdownRailOrder(evaluated.result.cat,evaluated.cards);
  const treatment=showdownRailTreatments(evaluated.result.cat,evaluated.result.tiebreak,ordered);
  return {
    playerId:player.id,
    result:evaluated.result,
    cards:ordered.map((card,index)=>({
      rank:card.rank,suit:card.suit,value:card.value,key:cardKey(card),treatment:treatment[index],
      source:player.hole.some(c=>cardKey(c)===cardKey(card))?player.id:'board'
    }))
  };
}

function buildShowdownRailModel(fixture,awardId){
  const award=fixture.awards.find(a=>a.id===(awardId||fixture.previewAward)) || fixture.awards[0];
  if (!award) throw new Error('Fixture has no award: '+fixture.id);
  const winnerHands=award.winnerIds.map(id=>{
    const player=fixture.players.find(p=>p.id===id);
    if (!player) throw new Error('Unknown winner '+id+' in '+fixture.id);
    return showdownRailEvaluatePlayer(fixture,player);
  });
  const first=winnerHands[0];
  winnerHands.slice(1).forEach(hand=>{
    if (compareHands(first.result,hand.result)!==0) throw new Error('Split winners do not tie: '+fixture.id);
  });
  const signatures=winnerHands.map(hand=>hand.cards.map(c=>c.key).sort().join('|'));
  return {
    fixtureId:fixture.id,
    fixtureName:fixture.name,
    winnerIds:award.winnerIds.slice(),
    winnerLabel:showdownRailWinnerLabel(fixture.players,award.winnerIds),
    split:award.winnerIds.length>1,
    sharedBestFive:new Set(signatures).size===1,
    handName:describeMade(first.result),
    category:first.result.cat,
    cards:first.cards,
    winnerHands,
    award:{id:award.id,label:award.label,amount:award.amount,text:award.label+' · '+award.amount.toLocaleString()}
  };
}

function showdownRailFixture(id,name,board,players,awards,previewAward,note){
  return Object.freeze({
    id,name,note:note||'',board:board.map(showdownRailCard),
    players:players.map(p=>Object.freeze({
      id:p.id,name:p.name,isHuman:p.id==='you',hidden:p.hidden===true,
      hole:p.hole.map(showdownRailCard)
    })),
    awards:awards.map(a=>Object.freeze({id:a.id,label:a.label,amount:a.amount,winnerIds:a.winnerIds.slice()})),
    previewAward
  });
}

const SHOWDOWN_RAIL_FIXTURES=Object.freeze([
  showdownRailFixture('human-pair','Human wins · one pair',
    ['A♥','9♣','7♦','4♠','2♥'],
    [{id:'you',name:'You',hole:['A♠','Q♦']},{id:'mara',name:'Mara',hole:['K♣','J♣']}],
    [{id:'main',label:'Main Pot',amount:1240,winnerIds:['you']}],'main','Pair together first, then three kickers.'),
  showdownRailFixture('opponent-two-pair','Opponent wins · two pair',
    ['K♦','9♦','A♣','5♥','2♣'],
    [{id:'you',name:'You',hole:['Q♠','J♠']},{id:'mara',name:'Mara',hole:['K♠','9♠']}],
    [{id:'main',label:'Main Pot',amount:860,winnerIds:['mara']}],'main','Higher pair, lower pair, then kicker.'),
  showdownRailFixture('trips','Three of a kind',
    ['8♦','A♣','K♣','4♥','2♦'],
    [{id:'you',name:'You',hole:['8♠','8♥']},{id:'mara',name:'Mara',hole:['A♦','Q♠']}],
    [{id:'main',label:'Main Pot',amount:700,winnerIds:['you']}],'main','Trips grouped before descending kickers.'),
  showdownRailFixture('mixed-straight','Mixed-source straight · out of order',
    ['Q♦','8♣','J♥','2♠','A♣'],
    [{id:'you',name:'You',hole:['7♦','7♣']},{id:'mara',name:'Mara',hole:['10♠','9♥']}],
    [{id:'main',label:'Main Pot',amount:940,winnerIds:['mara']}],'main','Board and hole cards converge into Q–J–10–9–8.'),
  showdownRailFixture('wheel','Wheel straight',
    ['5♠','2♥','4♣','K♦','Q♠'],
    [{id:'you',name:'You',hole:['A♣','3♦']},{id:'mara',name:'Mara',hole:['K♣','J♣']}],
    [{id:'main',label:'Main Pot',amount:520,winnerIds:['you']}],'main','Ace is visually low: 5–4–3–2–A.'),
  showdownRailFixture('flush','Flush',
    ['2♥','Q♥','9♥','K♣','3♦'],
    [{id:'you',name:'You',hole:['K♠','J♦']},{id:'mara',name:'Mara',hole:['A♥','7♥']}],
    [{id:'main',label:'Main Pot',amount:1180,winnerIds:['mara']}],'main','All five suited cards read as the made hand.'),
  showdownRailFixture('full-house','Full house',
    ['6♣','8♦','8♠','A♥','2♣'],
    [{id:'you',name:'You',hole:['6♠','6♦']},{id:'mara',name:'Mara',hole:['A♠','K♠']}],
    [{id:'main',label:'Main Pot',amount:1560,winnerIds:['you']}],'main','Three Sixes followed by the pair of Eights.'),
  showdownRailFixture('quads','Four of a kind',
    ['J♦','J♣','A♠','5♥','2♦'],
    [{id:'you',name:'You',hole:['A♥','K♥']},{id:'mara',name:'Mara',hole:['J♠','J♥']}],
    [{id:'main',label:'Main Pot',amount:2020,winnerIds:['mara']}],'main','Four Jacks together, Ace kicker last.'),
  showdownRailFixture('board-split','Board plays · split pot',
    ['A♠','K♦','Q♣','J♥','10♠'],
    [{id:'you',name:'You',hole:['2♣','3♣']},{id:'mara',name:'Mara',hole:['4♦','5♦']}],
    [{id:'main',label:'Split Main Pot',amount:1000,winnerIds:['you','mara']}],'main','The exact same five board cards play for both winners.'),
  showdownRailFixture('split-hole-sources','Split pot · different hole-card sources',
    ['K♣','K♦','Q♠','J♥','2♣'],
    [{id:'you',name:'You',hole:['A♠','3♦']},{id:'mara',name:'Mara',hole:['A♥','4♥']}],
    [{id:'main',label:'Split Main Pot',amount:760,winnerIds:['you','mara']}],'main','Equal hands use a different Ace from each winning seat.'),
  showdownRailFixture('side-pot-winner','Side pot · different winner',
    ['A♠','J♠','10♠','2♦','3♣'],
    [{id:'you',name:'You',hole:['K♠','Q♠']},{id:'mara',name:'Mara',hole:['9♠','8♠']},{id:'sol',name:'Sol',hole:['A♥','A♦']}],
    [{id:'main',label:'Main Pot',amount:900,winnerIds:['you']},{id:'side',label:'Side Pot',amount:760,winnerIds:['mara']}],
    'side','The side-pot winner is previewed independently from the main-pot winner.'),
  showdownRailFixture('hidden-opponent','Opponent hole cards reveal in flight',
    ['Q♦','7♣','4♠','2♥','A♦'],
    [{id:'you',name:'You',hole:['A♣','K♣']},{id:'mara',name:'Mara',hole:['Q♠','Q♥'],hidden:true}],
    [{id:'main',label:'Main Pot',amount:1320,winnerIds:['mara']}],'main','The winning opponent cards begin face-down and turn during travel.'),
  showdownRailFixture('high-card','High card',
    ['K♦','9♣','7♦','4♠','2♥'],
    [{id:'you',name:'You',hole:['A♠','Q♦']},{id:'mara',name:'Mara',hole:['J♣','10♣']}],
    [{id:'main',label:'Main Pot',amount:380,winnerIds:['you']}],'main','Ace leads; four supporting cards trail in descending order.'),
  showdownRailFixture('straight-flush','Straight flush',
    ['9♣','7♣','6♣','2♦','A♥'],
    [{id:'you',name:'You',hole:['5♠','5♥']},{id:'mara',name:'Mara',hole:['10♣','8♣']}],
    [{id:'main',label:'Main Pot',amount:2440,winnerIds:['mara']}],'main','All five cards form one descending suited run.')
]);

function showdownRailFixtureById(id){
  return SHOWDOWN_RAIL_FIXTURES.find(f=>f.id===id) || SHOWDOWN_RAIL_FIXTURES[0];
}
