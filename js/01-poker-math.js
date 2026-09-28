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
/* Equity against `numOpponents` random hands. Since v0.51 this runs on the
   fast evaluator (estimateEquityVsRanges with no range = any two cards,
   which deals exactly as a shuffled deck would); the old evaluate7 loop is
   kept as the reference in validation/ai-behaviour-checks.js. */
function estimateEquity(holeCards, board, numOpponents, iterations){
  const ranges = [];
  for (let o=0;o<numOpponents;o++) ranges.push(null);
  return estimateEquityVsRanges(holeCards, board, ranges, iterations);
}

/* ============================================================
   FAST EVALUATION + RANGES  (AI; also serialised into the worker)
   ============================================================
   Cards as small ints for the equity loops: code = (value-2)*4 + suit,
   so rank index 0..12 is 2..A. fastScore7() gives ONE integer per hand
   whose ordering is exactly compareHands(evaluate7(...)) — same category
   order, same tiebreaks (validation/ai-behaviour-checks.js proves it on
   every 5-card hand and on random 7-card hands). The game's showdown and
   hand naming still use evaluate7; this is only for the AI's sampling. */
function cardCode(c){ return (c.value-2)*4 + SUITS.indexOf(c.suit); }

/* Highest straight in a 13-bit rank mask, as a rank index (3 = the wheel's
   five), or -1. */
function straightHighOf(mask){
  for (let hi=12; hi>=4; hi--) if (((mask >> (hi-4)) & 31) === 31) return hi;
  if ((mask & 0x100F) === 0x100F) return 3;
  return -1;
}
/* Appends the highest set ranks to `out` until it holds n entries. */
function topBits(mask, n, out){
  for (let r=12; r>=0 && out.length<n; r--) if (mask & (1<<r)) out.push(r);
  return out;
}
function packScore(cat, t){
  let s = cat;
  for (let i=0;i<5;i++) s = s*16 + (i < t.length ? t[i]+1 : 0);
  return s;
}
/* cards: array of int codes (5, 6 or 7 of them). */
function fastScore7(cards){
  const counts = [0,0,0,0,0,0,0,0,0,0,0,0,0];
  const suitMask = [0,0,0,0];
  let rankMask = 0;
  for (let i=0;i<cards.length;i++){
    const c = cards[i], r = c >> 2;
    counts[r]++; suitMask[c & 3] |= 1 << r; rankMask |= 1 << r;
  }
  let flushMask = 0;
  for (let s=0;s<4;s++){
    let m = suitMask[s], n = 0;
    while (m){ m &= m-1; n++; }
    if (n >= 5){ flushMask = suitMask[s]; break; }
  }
  if (flushMask){
    const sf = straightHighOf(flushMask);
    if (sf >= 0) return packScore(sf === 12 ? 9 : 8, [sf]);
  }
  let quad=-1, trip=-1, trip2=-1, pair=-1, pair2=-1;
  for (let r=12;r>=0;r--){
    const n = counts[r];
    if (n === 4) quad = r;
    else if (n === 3){ if (trip < 0) trip = r; else if (trip2 < 0) trip2 = r; }
    else if (n === 2){ if (pair < 0) pair = r; else if (pair2 < 0) pair2 = r; }
  }
  if (quad >= 0) return packScore(7, [quad, topBits(rankMask & ~(1<<quad), 1, [])[0]]);
  if (trip >= 0){
    const p = Math.max(trip2, pair);
    if (p >= 0) return packScore(6, [trip, p]);
  }
  if (flushMask) return packScore(5, topBits(flushMask, 5, []));
  const st = straightHighOf(rankMask);
  if (st >= 0) return packScore(4, [st]);
  if (trip >= 0) return packScore(3, topBits(rankMask & ~(1<<trip), 3, [trip]));
  if (pair >= 0 && pair2 >= 0) return packScore(2, [pair, pair2, topBits(rankMask & ~(1<<pair) & ~(1<<pair2), 1, [])[0]]);
  if (pair >= 0) return packScore(1, topBits(rankMask & ~(1<<pair), 4, [pair]));
  return packScore(0, topBits(rankMask, 5, []));
}

/* The 169 starting-hand classes, strongest first. Generated by
   validation/tools/preflop-order.js (a blend of equity heads-up and
   against three random hands, so both big cards and playability count). */
const PREFLOP_ORDER =
  'AA KK QQ JJ TT 99 88 77 AKs AQs KQs 66 AJs AKo KJs ATs AQo AJo QJs A9s KTs ATo 55 KQo A8s A7s QTs KJo JTs A6s K9s A5s A9o KTo A4s A8o A3s QJo K8s Q9s K7s A7o 44 A2s QTo J9s K9o T9s A5o Q8s K6s A6o K5s JTo A4o Q9o K4s K8o A3o T8s Q7s 33 J8s 98s K3s K7o A2o Q6s K2s J9o K6o Q5s T9o Q8o J7s 87s K5o 97s Q4s T7s J8o K4o J6s 22 Q3s Q7o T8o Q2s 76s J5s K3o Q6o T6s 98o 86s J7o 96s J4s K2o Q5o 65s J3s T5s T7o Q4o 75s 85s J2s 97o T4s 54s J6o 95s Q3o 87o T3s Q2o J5o T2s T6o 64s 84s 76o J4o 86o 96o 94s 74s 93s J3o T5o 53s J2o 92s 65o T4o 63s 83s 95o 75o 85o 43s 73s 82s T3o T2o 54o 52s 62s 64o 94o 72s 84o 74o 93o 42s 32s 53o 92o 63o 73o 83o 43o 82o 52o 62o 72o 42o 32o';

/* Class name of two hole cards: 'AA', 'AKs', 'T9o' ... */
const RANK_CHARS = '23456789TJQKA';
function holeClass(a, b){
  const ra = typeof a === 'number' ? a >> 2 : a.value-2, rb = typeof b === 'number' ? b >> 2 : b.value-2;
  const sa = typeof a === 'number' ? a & 3 : SUITS.indexOf(a.suit), sb = typeof b === 'number' ? b & 3 : SUITS.indexOf(b.suit);
  const hi = Math.max(ra, rb), lo = Math.min(ra, rb);
  if (hi === lo) return RANK_CHARS[hi] + RANK_CHARS[lo];
  return RANK_CHARS[hi] + RANK_CHARS[lo] + (sa === sb ? 's' : 'o');
}
/* All 1326 two-card combos, strongest class first. A "top 20% range" is
   the first 20% of this list: combos, not classes, so pairs (6 combos),
   suited (4) and offsuit (12) hands carry their real weight. */
let _comboOrder = null, _classRank = null;
function comboOrder(){
  if (_comboOrder) return _comboOrder;
  const classes = PREFLOP_ORDER.split(' ');
  _classRank = {};
  classes.forEach((k,i)=>{ _classRank[k] = i; });
  const combos = [];
  for (let a=0;a<52;a++) for (let b=a+1;b<52;b++) combos.push([a,b,_classRank[holeClass(a,b)]]);
  combos.sort((x,y)=>x[2]-y[2] || x[0]-y[0] || x[1]-y[1]);
  _comboOrder = combos;
  return combos;
}
/* Where a hand sits among all starting hands: 0 = the very best (AA),
   ~1 = the very worst. The share of combos strictly stronger than it,
   plus half its own class — a hand "in the top 20%" has percentile < 0.2. */
let _classPct = null;
function preflopPercentile(hole){
  if (!_classPct){
    const combos = comboOrder();
    const first = {}, count = {};
    combos.forEach((c,i)=>{ if (first[c[2]] === undefined) first[c[2]] = i; count[c[2]] = (count[c[2]]||0)+1; });
    _classPct = {};
    for (const k in first) _classPct[k] = (first[k] + count[k]/2) / combos.length;
  }
  comboOrder();
  return _classPct[_classRank[holeClass(hole[0], hole[1])]];
}

/* Equity of `hole` on `board` against opponents whose hands are drawn from
   ranges. ranges: one entry per opponent — a number in (0,1] is "their best
   X% of hands"; null/1 is any two cards. Pure sampling; no hidden cards are
   involved (the AI calls this with its own cards and the public board). */
function estimateEquityVsRanges(holeCards, board, ranges, iterations){
  const combos = comboOrder();
  const hole = holeCards.map(cardCode), brd = board.map(cardCode);
  const dead = new Array(52).fill(false);
  hole.concat(brd).forEach(c=>{ dead[c] = true; });
  const used = new Array(52);
  const deck = new Array(52);
  const opp = [];
  let winShare = 0;
  for (let iter=0; iter<iterations; iter++){
    for (let i=0;i<52;i++) used[i] = dead[i];
    opp.length = 0;
    for (let o=0;o<ranges.length;o++){
      const r = ranges[o];
      const k = (r == null || r >= 1) ? combos.length : Math.max(1, Math.round(r * combos.length));
      let pick = null;
      for (let t=0; t<60 && !pick; t++){
        const c = combos[Math.floor(Math.random()*k)];
        if (!used[c[0]] && !used[c[1]]) pick = c;
      }
      if (!pick){   // range is fully blocked by known cards: any legal hand
        for (let t=0; t<400 && !pick; t++){
          const c = combos[Math.floor(Math.random()*combos.length)];
          if (!used[c[0]] && !used[c[1]]) pick = c;
        }
      }
      used[pick[0]] = used[pick[1]] = true;
      opp.push(pick);
    }
    let n = 0;
    for (let i=0;i<52;i++) if (!used[i]) deck[n++] = i;
    const full = brd.slice();
    while (full.length < 5){
      const j = Math.floor(Math.random()*n);
      full.push(deck[j]); deck[j] = deck[--n];
    }
    const mine = fastScore7(hole.concat(full));
    let winners = 1, beaten = false;
    for (let o=0;o<opp.length;o++){
      const s = fastScore7([opp[o][0], opp[o][1]].concat(full));
      if (s > mine){ beaten = true; break; }
      if (s === mine) winners++;
    }
    if (!beaten) winShare += 1/winners;
  }
  return winShare/iterations;
}

/* Where a made hand sits WITHIN a range on this board: 0 = nothing in the
   range beats it, 1 = everything does. This is how a thinking player sees
   a hand ("top pair is near the top of what I can have here"), as opposed
   to its raw equity. Made strength only: draws are judged separately.
   rangePct: the range as "best X% of starting hands". */
function rangeRelStrength(holeCards, board, rangePct){
  const combos = comboOrder();
  const brd = board.map(cardCode);
  const dead = new Array(52).fill(false);
  brd.forEach(c=>{ dead[c] = true; });
  const mine = fastScore7(holeCards.map(cardCode).concat(brd));
  const k = Math.max(1, Math.min(combos.length, Math.round((rangePct == null ? 1 : rangePct) * combos.length)));
  let better = 0, equal = 0, n = 0;
  for (let i=0;i<k;i++){
    const c = combos[i];
    if (dead[c[0]] || dead[c[1]]) continue;
    const s = fastScore7([c[0], c[1]].concat(brd));
    n++;
    if (s > mine) better++; else if (s === mine) equal++;
  }
  return n ? (better + equal/2) / n : 0.5;
}

/* ============================================================
   POSTFLOP HAND CLASS  (AI, Step 3 builds decisions on it)
   ============================================================
   What a player's own two cards are doing on this board, in the words a
   player would use: made hand, draws, and the board's texture.
     made:  'straight-flush' | 'quads' | 'full-house' | 'flush' |
            'straight' | 'set' | 'trips' | 'two-pair' | 'overpair' |
            'top-pair' | 'second-pair' | 'weak-pair' | 'nothing'
            ('nothing' includes a pair that is only on the board)
     kicker: rank index (0-12) of the side card with top-pair, else -1
     boardPlays: the best hand is on the board alone (a 5-card board only)
     draws: { flush, nutFlush, oesd, gutshot, backdoorFlush, overcards }
     texture: { paired, flushy (0 none, 1 two-tone, 2 three+ of a suit),
                connected (a straight is possible), high (top rank index),
                wet (0..1: how many draws the board allows) } */
function classifyPostflop(holeCards, board){
  const hole = holeCards.map(cardCode), brd = board.map(cardCode);
  const all = hole.concat(brd);
  const rk = c => c >> 2, st = c => c & 3;
  const boardRanks = brd.map(rk).sort((a,b)=>b-a);
  const top = boardRanks[0], second = boardRanks.find(r=>r < top);
  const cnt = arr => { const m = {}; arr.forEach(r=>{ m[r] = (m[r]||0)+1; }); return m; };
  const bCount = cnt(brd.map(rk));
  const holeR = hole.map(rk);
  const pocket = holeR[0] === holeR[1];

  const score = fastScore7(all);
  const cat = Math.floor(score / Math.pow(16, 5));
  const boardPlays = brd.length === 5 && fastScore7(brd) === score;

  let made = 'nothing', kicker = -1;
  if (boardPlays) made = 'nothing';
  else if (cat === 8 || cat === 9) made = 'straight-flush';
  else if (cat === 7) made = 'quads';
  else if (cat === 6) made = 'full-house';
  else if (cat === 5) made = 'flush';
  else if (cat === 4) made = 'straight';
  else if (cat === 3){
    if (pocket && bCount[holeR[0]] === 1) made = 'set';
    else made = holeR.some(r => bCount[r]) ? 'trips' : 'nothing';   // trips on the board are everyone's
  }
  else if (cat === 2){
    // two pair that uses a hole card; a board pair plus one of ours plays as one pair
    const ownPairs = [...new Set(holeR)].filter(r => bCount[r] || pocket).length;
    const boardPaired = Object.values(bCount).some(n=>n >= 2);
    if (ownPairs >= 2 || (ownPairs === 1 && !boardPaired)) made = 'two-pair';
    else made = null;   // judge the pair of ours below
  } else if (cat === 1) made = null;
  if (made === null){
    const hit = holeR.filter(r => bCount[r]).sort((a,b)=>b-a);
    if (pocket && !bCount[holeR[0]]) made = holeR[0] > top ? 'overpair' : holeR[0] > (second ?? -1) ? 'second-pair' : 'weak-pair';
    else if (hit.length && hit[0] === top){ made = 'top-pair'; kicker = holeR.find(r => r !== top) ?? -1; }
    else if (hit.length && hit[0] === second) made = 'second-pair';
    else if (hit.length) made = 'weak-pair';
    else made = 'nothing';
  }

  // draws (not on the river)
  const draws = { flush:false, nutFlush:false, oesd:false, gutshot:false, backdoorFlush:false, overcards:false };
  if (brd.length >= 3 && brd.length < 5){
    for (let s=0;s<4;s++){
      const inSuit = all.filter(c=>st(c) === s), mine = hole.filter(c=>st(c) === s);
      if (inSuit.length === 4 && mine.length){
        draws.flush = true;
        const missingTop = [12,11,10,9,8,7,6,5,4,3,2,1,0].find(r => !inSuit.some(c=>rk(c) === r));
        draws.nutFlush = mine.some(c=>rk(c) === missingTop) || mine.some(c=>rk(c) === 12);
      }
      if (brd.length === 3 && inSuit.length === 3 && mine.length) draws.backdoorFlush = true;
    }
    if (cat < 4){
      let mask = 0, holeMask = 0;
      all.forEach(c=>{ mask |= 1 << rk(c); });
      hole.forEach(c=>{ holeMask |= 1 << rk(c); });
      const ext = m => (m << 1) | ((m >> 12) & 1);   // bit 0 = ace-low
      const M = ext(mask), H = ext(holeMask);
      const completers = new Set();
      for (let lo=0; lo<=9; lo++){
        const w = 31 << lo, have = M & w;
        let n = 0, x = have; while (x){ x &= x-1; n++; }
        if (n === 4 && (H & w)){
          const bit = lo + [0,1,2,3,4].find(i => !(have & (1 << (lo+i))));
          completers.add(bit === 0 ? 13 : bit);   // ace-low and ace-high are one card
        }
      }
      if (completers.size >= 2) draws.oesd = true; else if (completers.size === 1) draws.gutshot = true;
    }
    draws.overcards = made === 'nothing' && holeR.every(r => r > top);
  }

  // texture
  const suitCounts = [0,0,0,0]; brd.forEach(c=>suitCounts[st(c)]++);
  const maxSuit = Math.max(...suitCounts);
  let bmask = 0; brd.forEach(c=>{ bmask |= 1 << rk(c); });
  const bext = (bmask << 1) | ((bmask >> 12) & 1);
  let connected = false, closeness = 0;
  for (let lo=0; lo<=9; lo++){
    let x = bext & (31 << lo), n = 0; while (x){ x &= x-1; n++; }
    if (n >= 3) connected = true;
    closeness = Math.max(closeness, n);
  }
  const paired = Object.values(bCount).some(n=>n >= 2);
  const texture = {
    paired, flushy: maxSuit >= 3 ? 2 : maxSuit === 2 ? 1 : 0, connected, high: top,
    wet: Math.min(1, (maxSuit >= 3 ? 0.45 : maxSuit === 2 ? 0.2 : 0) + (closeness >= 3 ? 0.4 : closeness === 2 ? 0.15 : 0) + (paired ? -0.1 : 0) + 0.05),
  };
  return { made, kicker, boardPlays, draws, texture };
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
        cardCode.toString(), straightHighOf.toString(), topBits.toString(), packScore.toString(),
        fastScore7.toString(),
        'const PREFLOP_ORDER=' + JSON.stringify(PREFLOP_ORDER) + ';',
        'const RANK_CHARS=' + JSON.stringify(RANK_CHARS) + ';',
        'let _comboOrder=null, _classRank=null;',
        holeClass.toString(), comboOrder.toString(), estimateEquityVsRanges.toString(),
        'self.onmessage=function(e){',
        '  var d=e.data;',
        '  try{ var eq=d.ranges ? estimateEquityVsRanges(d.hole,d.board,d.ranges,d.iters) : estimateEquity(d.hole,d.board,d.numOpp,d.iters); self.postMessage({id:d.id,eq:eq}); }',
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
  function keyFor(hole, board, numOpp, iters, ranges){
    return hole.map(cardKey).sort().join('') + '|' + board.map(cardKey).join('') + '|' + numOpp + '|' + iters +
      (ranges ? '|' + ranges.map(r => r == null ? '*' : (+r).toFixed(3)).join(',') : '');
  }

  return {
    init(){ if (!worker) worker = buildWorker(); },
    available(){ return !!worker; },
    /* ranges (optional): one entry per opponent, "their best X% of hands"
       as a fraction, or null for any two cards. When given, numOpp is
       ranges.length. */
    async get(hole, board, numOpp, iters, ranges){
      if (ranges) numOpp = ranges.length;
      const k = keyFor(hole, board, numOpp, iters, ranges);
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
            worker.postMessage({ id, hole: hole.map(strip), board: board.map(strip), numOpp, iters, ranges: ranges || null });
          } catch(e){ clearTimeout(bail); pending.delete(id); resolve(null); }
        });
      }
      if (value === null || value === undefined){
        // fallback: run inline at reduced sample count so the freeze stays short
        value = ranges ? estimateEquityVsRanges(hole, board, ranges, Math.min(iters, 90))
                       : estimateEquity(hole, board, numOpp, Math.min(iters, 90));
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

