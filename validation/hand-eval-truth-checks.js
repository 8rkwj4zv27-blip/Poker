#!/usr/bin/env node
"use strict";

/* Hand evaluation against poker's ground truth (js/01-poker-math.js).
   ai-behaviour-checks proves the fast evaluator orders hands exactly as
   evaluate7 does, but that only shows the two agree. This suite checks the
   real evaluator against facts that do not come from the code: every one
   of the 2,598,960 five-card hands is dealt, and the count of each hand
   type must equal the published totals. A handful of classic tie-breaks
   (the wheel, kickers, board plays) follow. About 10 seconds.
   Run: node validation/hand-eval-truth-checks.js */

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }

// 01-poker-math.js is pure (it also runs inside the AI worker)
const sandbox={ console, Math };
vm.createContext(sandbox);
vm.runInContext(read('js/01-poker-math.js')+'\n;this.__api={createDeck,evaluate5,evaluate7,compareHands,HAND_NAMES};',sandbox,{ filename:'01-poker-math.js' });
const { createDeck, evaluate5, evaluate7, compareHands, HAND_NAMES }=sandbox.__api;

const deck=createDeck();
const SUIT={ s:'♠', h:'♥', d:'♦', c:'♣' };
const card=s=>{ // 'As', 'Td', '9c'
  const rank=s[0]==='T' ? '10' : s[0], suit=SUIT[s[1]];
  const c=deck.find(d=>d.rank===rank && d.suit===suit);
  assert.ok(c,'no card '+s+' in the deck');
  return c;
};
const hand=str=>str.split(' ').map(card);
const best=str=>evaluate7(hand(str));

check('the deck is 52 distinct cards',()=>{
  assert.strictEqual(deck.length,52);
  assert.strictEqual(new Set(deck.map(c=>c.rank+'|'+c.suit)).size,52);
});

check('every five-card hand lands in its published category total',()=>{
  // categories: 0 high card ... 8 straight flush, 9 royal flush.
  // Published totals count royals inside straight flushes (36 + 4 = 40).
  const want=[1302540,1098240,123552,54912,10200,5108,3744,624,36,4];
  const got=new Array(10).fill(0);
  for (let a=0;a<52;a++) for (let b=a+1;b<52;b++) for (let c=b+1;c<52;c++)
    for (let d=c+1;d<52;d++) for (let e=d+1;e<52;e++)
      got[evaluate5([deck[a],deck[b],deck[c],deck[d],deck[e]]).cat]++;
  const total=got.reduce((s,n)=>s+n,0);
  assert.strictEqual(total,2598960,'dealt '+total+' hands');
  want.forEach((n,i)=>assert.strictEqual(got[i],n,HAND_NAMES[i]+': '+got[i]+', expected '+n));
});

check('the wheel is the lowest straight',()=>{
  const wheel=best('As 2d 3c 4h 5s Kd Qc'), six=best('2d 3c 4h 5s 6d Kd Qc');
  assert.strictEqual(wheel.cat,4); assert.strictEqual(six.cat,4);
  assert.ok(compareHands(six,wheel)>0,'6-high straight must beat the wheel');
});

check('ace-high straight flush is the royal flush; steel wheel is a straight flush',()=>{
  assert.strictEqual(best('As Ks Qs Js Ts 2d 3c').cat,9);
  assert.strictEqual(best('As 2s 3s 4s 5s Kd Qc').cat,8);
});

check('kickers decide equal pairs',()=>{
  const aceKing=best('Ah Kd 7c 4s 2h Ad 9c'), aceQueen=best('Ah Qd 7c 4s 2h Ad 9c');
  assert.strictEqual(aceKing.cat,1);
  assert.ok(compareHands(aceKing,aceQueen)>0,'A-A-K must beat A-A-Q');
});

check('the best five of seven are used, and the board can play',()=>{
  // board is a broadway straight; both hole hands are worse than the board
  const p1=best('2c 3d Ah Kh Qd Jc Ts'), p2=best('4c 5d Ah Kh Qd Jc Ts');
  assert.strictEqual(p1.cat,4);
  assert.strictEqual(compareHands(p1,p2),0,'both play the board: a split');
});

check('full house compares trips first, then the pair',()=>{
  const tensFull=best('Tc Td Th 2s 2d 9c 8h'), ninesFullOfAces=best('9c 9d 9h As Ad 3c 4h');
  assert.strictEqual(tensFull.cat,6);
  assert.ok(compareHands(tensFull,ninesFullOfAces)>0,'tens full must beat nines full of aces');
});

check('a flush beats a straight; two pair counts only the best two pairs',()=>{
  assert.ok(compareHands(best('2h 7h 9h Jh Kh 3c 4d'),best('5c 6d 7h 8s 9c 2d 2h'))>0);
  const three=best('Ac Ad Kc Kd Qc Qd 2h');   // three pairs: A-A-K-K with the Q kicker
  assert.strictEqual(three.cat,2);
  assert.deepStrictEqual(Array.from(three.tiebreak),[14,13,12]);
});

process.stdout.write('\n'+passed+' hand evaluation truth checks passed.\n');
