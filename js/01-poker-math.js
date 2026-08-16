"use strict";

/* ============================================================
   CARD ENGINE  (also serialised into the worker — keep pure)
   ============================================================ */
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VALUES = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
const SUITS = ['♠','♥','♦','♣'];
const SUIT_CLASS = {'♠':'spade','♥':'heart','♦':'diamond','♣':'club'};
const SUIT_NAME  = {'♠':'Spades','♥':'Hearts','♦':'Diamonds','♣':'Clubs'};
const RANK_WORD = {2:'Two',3:'Three',4:'Four',5:'Five',6:'Six',7:'Seven',8:'Eight',9:'Nine',10:'Ten',11:'Jack',12:'Queen',13:'King',14:'Ace'};
const RANK_PLURAL = {2:'Twos',3:'Threes',4:'Fours',5:'Fives',6:'Sixes',7:'Sevens',8:'Eights',9:'Nines',10:'Tens',11:'Jacks',12:'Queens',13:'Kings',14:'Aces'};
const HAND_NAMES = ['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush','Royal Flush'];

function createDeck(){
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({rank:r, suit:s, value:RANK_VALUES[r]});
  return deck;
}
function shuffle(deck){
  const d = deck.slice();
  for (let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=d[i]; d[i]=d[j]; d[j]=t; }
  return d;
}
function cardKey(c){ return c.rank + c.suit; }
function combinations(arr,k){
  const out=[], combo=[];
  (function helper(start){
    if (combo.length===k){ out.push(combo.slice()); return; }
    for (let i=start;i<arr.length;i++){ combo.push(arr[i]); helper(i+1); combo.pop(); }
  })(0);
  return out;
}
function evaluate5(cards){
  const values = cards.map(c=>c.value).sort((a,b)=>b-a);
  const suits = cards.map(c=>c.suit);
  const isFlush = suits.every(s=>s===suits[0]);
  const counts = {};
  for (const v of values) counts[v]=(counts[v]||0)+1;
  const countEntries = Object.entries(counts).map(([v,c])=>[parseInt(v),c]).sort((a,b)=> b[1]-a[1] || b[0]-a[0]);
  const uniqueVals = [...new Set(values)];
  let isStraight=false, straightHigh=0;
  if (uniqueVals.includes(14)&&uniqueVals.includes(5)&&uniqueVals.includes(4)&&uniqueVals.includes(3)&&uniqueVals.includes(2)){ isStraight=true; straightHigh=5; }
  for (let i=0;i<=uniqueVals.length-5;i++){
    if (uniqueVals[i]-uniqueVals[i+4]===4){ isStraight=true; straightHigh=uniqueVals[i]; break; }
  }
  if (isStraight&&isFlush) return {cat:straightHigh===14?9:8, tiebreak:[straightHigh]};
  if (countEntries[0][1]===4) return {cat:7, tiebreak:[countEntries[0][0],countEntries[1][0]]};
  if (countEntries[0][1]===3 && countEntries[1] && countEntries[1][1]>=2) return {cat:6, tiebreak:[countEntries[0][0],countEntries[1][0]]};
  if (isFlush) return {cat:5, tiebreak:values};
  if (isStraight) return {cat:4, tiebreak:[straightHigh]};
  if (countEntries[0][1]===3) return {cat:3, tiebreak:[countEntries[0][0], ...countEntries.slice(1).map(e=>e[0])]};
  if (countEntries[0][1]===2 && countEntries[1] && countEntries[1][1]===2) return {cat:2, tiebreak:[countEntries[0][0],countEntries[1][0],countEntries[2][0]]};
  if (countEntries[0][1]===2) return {cat:1, tiebreak:[countEntries[0][0], ...countEntries.slice(1).map(e=>e[0])]};
  return {cat:0, tiebreak:values};
}
function compareHands(a,b){
  if (a.cat!==b.cat) return a.cat-b.cat;
  const len = Math.max(a.tiebreak.length,b.tiebreak.length);
  for (let i=0;i<len;i++){ const av=a.tiebreak[i]||0, bv=b.tiebreak[i]||0; if (av!==bv) return av-bv; }
  return 0;
}
function evaluate7(cards){
  const combos = combinations(cards,5);
  let best=null;
  for (const c of combos){ const r=evaluate5(c); if (!best||compareHands(r,best)>0) best=r; }
  return best;
}
/* Showdown-only: also returns which 5 of the 7 cards made the hand, for highlighting. */
function evaluate7WithCards(cards){
  const combos = combinations(cards,5);
  let best=null, bestCombo=null;
  for (const c of combos){
    const r = evaluate5(c);
    if (!best || compareHands(r,best)>0){ best=r; bestCombo=c; }
  }
  return { result:best, cards:bestCombo };
}
function estimateEquity(holeCards, board, numOpponents, iterations){
  const used = new Set([...holeCards, ...board].map(cardKey));
  const baseDeck = createDeck().filter(c=>!used.has(cardKey(c)));
  let winShare = 0;
  for (let iter=0; iter<iterations; iter++){
    const deck = shuffle(baseDeck);
    let idx=0;
    const oppHoles=[];
    for (let o=0;o<numOpponents;o++) oppHoles.push([deck[idx++],deck[idx++]]);
    const fullBoard = board.slice();
    while (fullBoard.length<5) fullBoard.push(deck[idx++]);
    const myHand = evaluate7([...holeCards, ...fullBoard]);
    let winners=1, beaten=false;
    for (const oh of oppHoles){
      const oppHand = evaluate7([...oh, ...fullBoard]);
      const cmp = compareHands(myHand, oppHand);
      if (cmp<0){ beaten=true; break; }
      if (cmp===0) winners++;
    }
    if (!beaten) winShare += 1/winners;
  }
  return winShare/iterations;
}

/* ============================================================
   EQUITY SERVICE — off the main thread, with sync fallback
   ============================================================ */
const EquityService = (function(){
  let worker = null, nextId = 1;
  const pending = new Map();
  const cache = new Map();

  function buildWorker(){
    try{
      if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return null;
      const src = [
        'const RANKS=' + JSON.stringify(RANKS) + ';',
        'const RANK_VALUES=' + JSON.stringify(RANK_VALUES) + ';',
        'const SUITS=' + JSON.stringify(SUITS) + ';',
        createDeck.toString(), shuffle.toString(), cardKey.toString(),
        combinations.toString(), evaluate5.toString(), compareHands.toString(),
        evaluate7.toString(), estimateEquity.toString(),
        'self.onmessage=function(e){',
        '  var d=e.data;',
        '  try{ var eq=estimateEquity(d.hole,d.board,d.numOpp,d.iters); self.postMessage({id:d.id,eq:eq}); }',
        '  catch(err){ self.postMessage({id:d.id,err:String(err)}); }',
        '};'
      ].join('\n');
      const w = new Worker(URL.createObjectURL(new Blob([src], {type:'application/javascript'})));
      w.onmessage = function(e){
        const {id, eq, err} = e.data;
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        if (err !== undefined) entry.reject(new Error(err)); else entry.resolve(eq);
      };
      w.onerror = function(){ teardown(); };
      return w;
    } catch(e){ return null; }
  }
  function teardown(){
    if (worker){ try{ worker.terminate(); }catch(e){} }
    worker = null;
    pending.forEach(entry=>entry.resolve(null));
    pending.clear();
  }
  function keyFor(hole, board, numOpp, iters){
    return hole.map(cardKey).sort().join('') + '|' + board.map(cardKey).join('') + '|' + numOpp + '|' + iters;
  }

  return {
    init(){ if (!worker) worker = buildWorker(); },
    available(){ return !!worker; },
    async get(hole, board, numOpp, iters){
      const k = keyFor(hole, board, numOpp, iters);
      if (cache.has(k)) return cache.get(k);
      let value = null;
      if (!worker) worker = buildWorker();
      if (worker){
        const id = nextId++;
        value = await new Promise((resolve, reject)=>{
          pending.set(id, {resolve, reject});
          const bail = setTimeout(()=>{ if (pending.has(id)){ pending.delete(id); resolve(null); } }, 6000);
          const wrapped = pending.get(id);
          wrapped.resolve = v=>{ clearTimeout(bail); resolve(v); };
          wrapped.reject = ()=>{ clearTimeout(bail); resolve(null); };
          try{
            worker.postMessage({ id, hole: hole.map(strip), board: board.map(strip), numOpp, iters });
          } catch(e){ clearTimeout(bail); pending.delete(id); resolve(null); }
        });
      }
      if (value === null || value === undefined){
        // fallback: run inline at reduced sample count so the freeze stays short
        value = estimateEquity(hole, board, numOpp, Math.min(iters, 90));
      }
      if (cache.size > 400) cache.clear();
      cache.set(k, value);
      return value;
    }
  };
  function strip(c){ return {rank:c.rank, suit:c.suit, value:c.value}; }
})();

/* ============================================================
   HAND DESCRIPTION
   ============================================================ */
function describeMade(res){
  const t = res.tiebreak;
  switch(res.cat){
    case 9: return 'Royal Flush';
    case 8: return 'Straight Flush, ' + RANK_WORD[t[0]] + ' high';
    case 7: return 'Four of a Kind, ' + RANK_PLURAL[t[0]];
    case 6: return 'Full House, ' + RANK_PLURAL[t[0]] + ' over ' + RANK_PLURAL[t[1]];
    case 5: return 'Flush, ' + RANK_WORD[t[0]] + ' high';
    case 4: return 'Straight, ' + RANK_WORD[t[0]] + ' high';
    case 3: return 'Three of a Kind, ' + RANK_PLURAL[t[0]];
    case 2: return 'Two Pair, ' + RANK_PLURAL[t[0]] + ' & ' + RANK_PLURAL[t[1]];
    case 1: return 'Pair of ' + RANK_PLURAL[t[0]];
    default: return RANK_WORD[t[0]] + ' high';
  }
}
function describeHole(hole){
  if (hole.length < 2) return '';
  const [a,b] = hole;
  if (a.value === b.value) return 'Pocket ' + RANK_PLURAL[a.value];
  const hi = a.value > b.value ? a : b;
  const lo = a.value > b.value ? b : a;
  return RANK_WORD[hi.value] + '-' + RANK_WORD[lo.value] + (a.suit === b.suit ? ' suited' : ' offsuit');
}
function describePlayerHand(hole, board){
  if (!hole || hole.length < 2) return '';
  if (board.length === 0) return describeHole(hole);
  return describeMade(evaluate7([...hole, ...board]));
}

/* ============================================================
   TEACHING ANALYSIS — draws, outs, board threats
   ============================================================ */

/* "a Ten" vs "an Eight" */
function article(word){ return /^[aeiou]/i.test(word) ? 'an ' : 'a '; }
function withArticle(word){ return article(word) + word; }

/* Cards still to come that would lift you to a better hand category. */
function computeOuts(hole, board){
  if (board.length < 3 || board.length >= 5) return {outs:0, cards:[]};
  const used = new Set([...hole, ...board].map(cardKey));
  const rest = createDeck().filter(c=>!used.has(cardKey(c)));
  const current = evaluate7([...hole, ...board]);
  const cards = [];
  for (const c of rest){
    const improved = evaluate7([...hole, ...board, c]);
    if (improved.cat > current.cat) cards.push(c);
  }
  return {outs: cards.length, cards};
}

/* Named draws the player is on. */
function detectDraws(hole, board){
  const draws = [];
  if (board.length < 3 || board.length >= 5) return draws;
  const all = [...hole, ...board];

  // flush draw — four to a suit with at least one of your own cards in it
  const bySuit = {};
  all.forEach(c=>{ (bySuit[c.suit] = bySuit[c.suit] || []).push(c); });
  for (const suit in bySuit){
    if (bySuit[suit].length === 4 && hole.some(c=>c.suit===suit)){
      draws.push({kind:'flush', outs:9, text:'a flush draw — any of the nine remaining ' + SUIT_NAME[suit].toLowerCase() + ' completes it'});
    }
  }

  // straight draw — which ranks would complete a five-card run
  const vals = new Set(all.map(c=>c.value));
  if (vals.has(14)) vals.add(1);
  const holeVals = new Set(hole.map(c=>c.value));
  if (holeVals.has(14)) holeVals.add(1);
  const completers = new Set();
  for (let lo=1; lo<=10; lo++){
    const window = [lo,lo+1,lo+2,lo+3,lo+4];
    const missing = window.filter(v=>!vals.has(v));
    // the draw must actually use one of your own cards, not just the board
    const usesHole = window.some(v=>holeVals.has(v));
    if (missing.length === 1 && usesHole){
      const need = missing[0] === 1 ? 14 : missing[0];
      if (need >= 2 && need <= 14) completers.add(need);
    }
  }
  if (completers.size >= 2){
    const names = [...completers].sort((a,b)=>a-b).map(v=>withArticle(RANK_WORD[v])).join(' or ');
    draws.push({kind:'straight', outs:completers.size*4, text:'an open-ended straight draw — ' + names + ' completes it'});
  } else if (completers.size === 1){
    const v = [...completers][0];
    draws.push({kind:'gutshot', outs:4, text:'an inside straight draw — only ' + withArticle(RANK_WORD[v]) + ' completes it'});
  }

  // overcards, only worth mentioning when you have nothing yet
  const made = evaluate7([...hole, ...board]);
  if (made.cat === 0 && board.length){
    const boardHigh = Math.max(...board.map(c=>c.value));
    const over = hole.filter(c=>c.value > boardHigh);
    if (over.length === 2) draws.push({kind:'overcards', outs:6, text:'two overcards — pairing either one would put you ahead of a single pair of the board'});
  }
  return draws;
}

/* What the board itself is threatening, irrespective of your hand. */
function boardThreats(board){
  const out = [];
  if (board.length < 3) return out;

  const bySuit = {};
  board.forEach(c=>{ bySuit[c.suit] = (bySuit[c.suit]||0)+1; });
  const flushSuit = Object.keys(bySuit).find(s=>bySuit[s] >= 3);
  if (flushSuit){
    out.push(bySuit[flushSuit] >= 4
      ? 'four ' + SUIT_NAME[flushSuit].toLowerCase() + ' are showing — anyone holding one more has a flush'
      : 'three ' + SUIT_NAME[flushSuit].toLowerCase() + ' are showing — a flush is possible');
  }

  const byRank = {};
  board.forEach(c=>{ byRank[c.value] = (byRank[c.value]||0)+1; });
  const trips = Object.keys(byRank).find(v=>byRank[v] >= 3);
  const pair = Object.keys(byRank).find(v=>byRank[v] === 2);
  if (trips) out.push('the board is tripled — a full house or quads is live');
  else if (pair) out.push('the board is paired — a full house is possible');

  const vals = [...new Set(board.map(c=>c.value))].sort((a,b)=>a-b);
  let straighty = false;
  for (let lo=1; lo<=10; lo++){
    const inWindow = vals.filter(v=>v>=lo && v<=lo+4).length;
    if (inWindow >= 3) straighty = true;
  }
  if (straighty && !trips) out.push('the board is connected — a straight is possible');

  const high = Math.max(...board.map(c=>c.value));
  if (!out.length && high >= 13) out.push(withArticle(RANK_WORD[high].toLowerCase()) + ' on the board beats any lower pair someone is holding');
  return out;
}

