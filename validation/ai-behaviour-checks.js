#!/usr/bin/env node
"use strict";
/* AI behaviour checks (docs/ai/AI_PLAN.md).

   Step 1 scope: the position fix and the measuring table itself. The
   tier stat bands in validation/tools/ai-harness.js are NOT asserted yet —
   the current AI doesn't meet them; later steps tune it in and then
   promote those bands into checks here. Full reports:
   node validation/tools/ai-sim.js */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { simulate, summarize, loadAI, PROBES, TIER_TARGETS } = require('./tools/ai-harness');

let passed = 0;
async function check(name, fn){ await fn(); passed++; process.stdout.write('PASS  ' + name + '\n'); }

function table(n, dealer, overrides){
  const players = Array.from({length:n}, (_, i) => Object.assign({ id:'p'+i, inHand:true, folded:false, allIn:false }, (overrides||{})[i]));
  return { players, dealerIndex:dealer };
}

(async () => {
  const A = loadAI(7);

  await check('Button is last to act: nobody sits after it', () => {
    A.setGame(table(6, 2));
    assert.strictEqual(A.seatsAfter(2), 0);
  });
  await check('Small blind has every live opponent after it', () => {
    A.setGame(table(6, 2));
    assert.strictEqual(A.seatsAfter(3), 5);
    assert.strictEqual(A.seatsAfter(4), 4);
    assert.strictEqual(A.seatsAfter(1), 1);   // cutoff: only the button behind
  });
  await check('Folded and all-in opponents do not count as acting after', () => {
    A.setGame(table(6, 2, { 1:{ folded:true }, 2:{ allIn:true }, 5:{ inHand:false } }));
    assert.strictEqual(A.seatsAfter(3), 2);   // seats 4 and 0 remain behind the SB
  });
  await check('Heads-up: the dealer acts last postflop, the big blind first', () => {
    A.setGame(table(2, 0));
    assert.strictEqual(A.seatsAfter(0), 0);
    assert.strictEqual(A.seatsAfter(1), 1);
  });
  await check('Position now reaches the AI: seats differ unless everyone is behind', () => {
    // the aiDecide term is positionWeight * (1 - seatsAfter/numOpp); before
    // the fix seatsAfter always equalled numOpp, so it was zero everywhere
    A.setGame(table(4, 0));
    const numOpp = 3;
    const terms = [0,1,2,3].map(i => 1 - A.seatsAfter(i)/numOpp);
    assert.deepStrictEqual(terms.map(t => +t.toFixed(3)), [1, 0, 0.333, 0.667]);
    Object.values(A.DIFFICULTY_PARAMS).forEach(dp => assert.ok(dp.positionWeight >= 0));
  });

  await check('Skill dial: every named difficulty plays exactly as before', () => {
    Object.keys(A.DIFFICULTY_PARAMS).forEach(d => {
      const got = A.aiDifficultyParams({}, { difficulty:d });
      assert.deepStrictEqual(JSON.parse(JSON.stringify(got)), JSON.parse(JSON.stringify(A.DIFFICULTY_PARAMS[d])), d);
    });
  });
  await check('Skill dial: a value between two rooms blends between them', () => {
    const mid = (A.SKILL_ANCHORS.medium + A.SKILL_ANCHORS.hard) / 2;
    const p = A.aiDifficultyParams({}, { difficulty:'elite', skill:mid });   // the number wins over the name
    const m = A.DIFFICULTY_PARAMS.medium, h = A.DIFFICULTY_PARAMS.hard;
    assert.strictEqual(p.iterations, Math.round((m.iterations + h.iterations) / 2));
    assert.ok(Math.abs(p.noise - (m.noise + h.noise) / 2) < 1e-9);
    assert.ok(Math.abs(p.positionWeight - (m.positionWeight + h.positionWeight) / 2) < 1e-9);
  });
  await check('Skill dial: rising skill never gets sloppier; the ends hold', () => {
    let prev = null;
    for (let s = 0; s <= 100; s += 5){
      const p = A.aiDifficultyParams({}, { skill:s });
      if (prev){
        assert.ok(p.iterations >= prev.iterations && p.noise <= prev.noise && p.positionWeight >= prev.positionWeight, 'at ' + s);
      }
      prev = p;
    }
    assert.deepStrictEqual(JSON.parse(JSON.stringify(A.aiDifficultyParams({}, { skill:0 }))), JSON.parse(JSON.stringify(A.DIFFICULTY_PARAMS.easy)));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(A.aiDifficultyParams({}, { skill:100 }))), JSON.parse(JSON.stringify(A.DIFFICULTY_PARAMS.elite)));
  });
  await check('Skill dial: a seat can out-skill its table; junk values fall back safely', () => {
    const g = { difficulty:'medium' };
    assert.strictEqual(A.aiSkillOf({ skill:85 }, g), 85);
    assert.strictEqual(A.aiSkillOf({}, g), A.SKILL_ANCHORS.medium);
    assert.strictEqual(A.aiSkillOf({ skill:'x' }, { skill:NaN, difficulty:'hard' }), A.SKILL_ANCHORS.hard);
    assert.strictEqual(A.aiSkillOf({ skill:250 }, g), 100);
    assert.strictEqual(A.aiSkillOf({}, { difficulty:'nonsense' }), A.SKILL_ANCHORS.medium);
  });

  /* ---- fast evaluator: must order hands exactly as evaluate7 does ---- */
  const FULL = process.argv.includes('--full');
  const deck52 = A.createDeck();
  const pickCards = (n, rnd) => {
    const d = deck52.slice();
    for (let i=0;i<n;i++){ const j = i + Math.floor(rnd()*(52-i)); const t = d[i]; d[i] = d[j]; d[j] = t; }
    return d.slice(0, n);
  };
  const { seeded } = require('./tools/ai-harness');
  await check(FULL ? 'Fast evaluator orders all 2,598,960 five-card hands exactly as evaluate7'
                   : 'Fast evaluator orders 200,000 random five-card hands exactly as evaluate7 (--full: all of them)', () => {
    const hands = [];
    if (FULL){
      for (let a=0;a<52;a++) for (let b=a+1;b<52;b++) for (let c=b+1;c<52;c++) for (let d=c+1;d<52;d++) for (let e=d+1;e<52;e++){
        const cs = [deck52[a],deck52[b],deck52[c],deck52[d],deck52[e]];
        hands.push([A.fastScore7(cs.map(A.cardCode)), cs]);
      }
    } else {
      const rnd = seeded(5);
      for (let i=0;i<200000;i++){ const cs = pickCards(5, rnd); hands.push([A.fastScore7(cs.map(A.cardCode)), cs]); }
    }
    hands.sort((x,y)=>x[0]-y[0]);
    // both orders are total preorders, so agreeing on every adjacent pair of
    // the sorted list means agreeing on every pair
    for (let i=1;i<hands.length;i++){
      const f = Math.sign(hands[i][0]-hands[i-1][0]);
      const s = Math.sign(A.compareHands(A.evaluate5(hands[i][1]), A.evaluate5(hands[i-1][1])));
      assert.strictEqual(f, s, 'order differs: ' + hands[i-1][1].map(A.cardCode) + ' vs ' + hands[i][1].map(A.cardCode));
    }
  });
  await check('Fast evaluator matches evaluate7 on 100,000 random seven-card showdowns', () => {
    const rnd = seeded(11);
    for (let i=0;i<100000;i++){
      const cs = pickCards(9, rnd);            // two hole pairs sharing one board
      const board = cs.slice(4), a = [cs[0], cs[1], ...board], b = [cs[2], cs[3], ...board];
      const f = Math.sign(A.fastScore7(a.map(A.cardCode)) - A.fastScore7(b.map(A.cardCode)));
      const s = Math.sign(A.compareHands(A.evaluate7(a), A.evaluate7(b)));
      assert.strictEqual(f, s, 'showdown differs: ' + a.map(A.cardCode) + ' vs ' + b.map(A.cardCode));
    }
  });
  await check('Equity on the fast path agrees with the old evaluate7 sampler', () => {
    // the pre-v0.51 estimateEquity, kept here as the reference
    const rnd = seeded(23);
    function reference(hole, board, numOpp, iters){
      const used = new Set([...hole, ...board].map(c=>c.rank+c.suit));
      const base = deck52.filter(c=>!used.has(c.rank+c.suit));
      let win = 0;
      for (let it=0; it<iters; it++){
        const d = base.slice();
        for (let i=0;i<numOpp*2+5-board.length;i++){ const j = i + Math.floor(rnd()*(d.length-i)); const t = d[i]; d[i] = d[j]; d[j] = t; }
        let k = 0; const opps = [];
        for (let o=0;o<numOpp;o++) opps.push([d[k++], d[k++]]);
        const full = board.slice(); while (full.length<5) full.push(d[k++]);
        const mine = A.evaluate7([...hole, ...full]);
        let winners = 1, beaten = false;
        for (const oh of opps){ const c = A.compareHands(mine, A.evaluate7([...oh, ...full])); if (c<0){ beaten = true; break; } if (c===0) winners++; }
        if (!beaten) win += 1/winners;
      }
      return win/iters;
    }
    const card = (r, s) => deck52.find(c => c.rank === r && c.suit === s);
    const spots = [
      [[card('A','♠'), card('A','♥')], [], 1],
      [[card('7','♦'), card('2','♣')], [], 3],
      [[card('K','♠'), card('Q','♠')], [card('J','♠'), card('10','♦'), card('3','♠')], 2],
      [[card('5','♥'), card('5','♦')], [card('A','♣'), card('K','♣'), card('5','♠'), card('9','♥')], 1],
    ];
    spots.forEach(([h, b, n]) => {
      const fast = A.estimateEquity(h, b, n, 6000), ref = reference(h, b, n, 6000);
      assert.ok(Math.abs(fast - ref) < 0.03, h.map(A.cardCode) + ': fast ' + fast.toFixed(3) + ' vs ref ' + ref.toFixed(3));
    });
  });
  await check('Starting hands: 169 classes, each once; ranges run strongest first', () => {
    const cls = A.PREFLOP_ORDER.split(' ');
    assert.strictEqual(cls.length, 169);
    assert.strictEqual(new Set(cls).size, 169);
    assert.strictEqual(A.comboOrder().length, 1326);
    const card = (r, s) => deck52.find(c => c.rank === r && c.suit === s);
    const pct = (a, b) => A.preflopPercentile([a, b]);
    assert.ok(pct(card('A','♠'), card('A','♥')) < 0.01);
    assert.ok(pct(card('A','♠'), card('K','♠')) < 0.05);
    assert.ok(pct(card('7','♦'), card('2','♣')) > 0.95);
    assert.ok(pct(card('J','♠'), card('10','♠')) < pct(card('J','♠'), card('10','♦')));   // suited beats offsuit
  });
  await check('Equity against a range: a strong range is harder to beat than any two cards', () => {
    const card = (r, s) => deck52.find(c => c.rank === r && c.suit === s);
    const hole = [card('A','♠'), card('J','♦')];
    const vsAny = A.estimateEquityVsRanges(hole, [], [null], 5000);
    const vsTight = A.estimateEquityVsRanges(hole, [], [0.05], 5000);
    assert.ok(vsAny > 0.58 && vsTight < 0.40, 'any ' + vsAny.toFixed(3) + ' tight ' + vsTight.toFixed(3));
  });

  /* ---- postflop hand class ---- */
  const C = s => {   // 'As' 'Td' '9h' ...
    const r = s[0] === 'T' ? '10' : s[0], suit = { s:'♠', h:'♥', d:'♦', c:'♣' }[s[1]];
    return deck52.find(c => c.rank === r && c.suit === suit);
  };
  const cls = (h, b) => A.classifyPostflop(h.split(' ').map(C), b.split(' ').map(C));
  await check('Hand class: made hands named the way a player would', () => {
    assert.strictEqual(cls('As Kd', 'Ah 7c 2s').made, 'top-pair');
    assert.strictEqual(cls('As Kd', 'Ah 7c 2s').kicker, 11);
    assert.strictEqual(cls('Qs Qd', 'Jh 7c 2s').made, 'overpair');
    assert.strictEqual(cls('7s 7d', 'Jh 7c 2s').made, 'set');
    assert.strictEqual(cls('Js 7d', 'Jh 7c 2s').made, 'two-pair');
    assert.strictEqual(cls('9s 8d', 'Jh 8c 2s').made, 'second-pair');
    assert.strictEqual(cls('5s 5d', 'Jh 8c 2s').made, 'weak-pair');
    assert.strictEqual(cls('As Kd', 'Qh Qc 2s').made, 'nothing');       // the pair is the board's
    assert.strictEqual(cls('As Kd', 'Qh Qc Qs').made, 'nothing');       // board trips too
    assert.strictEqual(cls('Qd 3h', 'Qh Qc 2s').made, 'trips');
    assert.strictEqual(cls('9s 8s', 'Ts 7s 2s').made, 'flush');
    assert.strictEqual(cls('9s 8s', 'Ts 7s 6s').made, 'straight-flush');
    assert.strictEqual(cls('9d 8c', 'Ts 7h 6s').made, 'straight');
    assert.strictEqual(cls('2d 3c', 'As Ks Qs Js Ts').boardPlays, true);
  });
  await check('Hand class: draws and board texture', () => {
    const fd = cls('As 5s', 'Ks 9s 2d');
    assert.ok(fd.draws.flush && fd.draws.nutFlush && !fd.draws.oesd);
    const oe = cls('9d 8c', 'Ts 7h 2s');
    assert.ok(oe.draws.oesd && !oe.draws.gutshot);
    const gut = cls('9d 8c', 'Js 7h 2s');
    assert.ok(gut.draws.gutshot && !gut.draws.oesd);
    const wheelAce = cls('Ad 2c', '3s 4h Kd');   // only a five completes: one draw, not two
    assert.ok(wheelAce.draws.gutshot && !wheelAce.draws.oesd);
    assert.ok(cls('Ad Kc', '7s 4h 2d').draws.overcards);
    assert.strictEqual(cls('Ad Kc', 'Ts 9s 8s').texture.flushy, 2);
    assert.ok(cls('Ad Kc', 'Ts 9s 8s').texture.wet > cls('Ad Kc', 'Ks 7h 2d').texture.wet);
    assert.ok(cls('Ad Kc', '7s 7h 2d').texture.paired);
    assert.deepStrictEqual(Object.values(cls('Ad Kc', 'Ts 9s 8s 2h 3d').draws).filter(Boolean), []);   // no draws on the river
  });

  /* ---- preflop from ranges ---- */
  // a fresh preflop table: n seats, dealer 0, blinds posted; hero at seat
  // `hero` holding `hand`; `raiseBy` [seat, total] opens before the hero
  function preflopTable(n, hero, hand, opts){
    opts = opts || {};
    const bb = 20;
    const players = Array.from({length:n}, (_, i) => ({ id:'p'+i, personality: A.PERSONALITIES_ALL.find(p=>p.key===(opts.key||'shark')),
      chips: opts.stack || 1500, hand: i === hero ? hand.split(' ').map(C) : [], inHand:true, folded:false, allIn:false,
      betThisRound:0, totalBetHand:0, acted:false, mayRaise:true, moodState:null, eliminated:false }));
    const g = { players, board:[], pot:0, currentBet:bb, minRaise:bb, bigBlind:bb, dealerIndex:0, difficulty:opts.difficulty || 'elite',
      mode:'cash', phase:'preflop', streetRaises:0, pfAggressorId:null };
    g.sbIndex = n === 2 ? 0 : 1; g.bbIndex = n === 2 ? 1 : 2;
    const put = (i, amt) => { const p = players[i]; p.chips -= amt; p.betThisRound += amt; p.totalBetHand += amt; g.pot += amt; };
    put(g.sbIndex, bb/2); put(g.bbIndex, bb);
    // everyone before the hero in preflop order folds, except an opener
    const order = i => (i - g.bbIndex - 1 + 2*n) % n;
    players.forEach((p, i) => {
      if (i === hero || order(i) > order(hero)) return;
      if (opts.raiseBy && opts.raiseBy[0] === i){ put(i, opts.raiseBy[1] - p.betThisRound); g.currentBet = opts.raiseBy[1];
        g.minRaise = opts.raiseBy[1] - bb; g.streetRaises = 1; g.pfAggressorId = p.id; p.acted = true; }
      else p.folded = true;
    });
    return { g, me: players[hero] };
  }
  async function freq(n, hero, hand, opts, want, trials){
    let k = 0;
    for (let t=0; t<(trials||200); t++){
      const { g, me } = preflopTable(n, hero, hand, opts);
      A.setGame(g);
      const d = await A.aiDecide(me, g);
      if (want.includes(d.action)) k++;
    }
    return k / (trials||200);
  }
  await check('Preflop: aces always play; seven-deuce offsuit folds from early position', async () => {
    assert.strictEqual(await freq(6, 3, 'As Ah', {}, ['raise','call']), 1);
    assert.ok(await freq(6, 3, '7d 2c', {}, ['fold']) > 0.97);
  });
  await check('Preflop: a skilled player opens wider on the button than under the gun', async () => {
    const utg = await freq(6, 3, 'Kd 9c', {}, ['raise']);
    const btn = await freq(6, 0, 'Kd 9c', {}, ['raise']);
    assert.ok(btn > 0.8 && utg < 0.2, 'btn ' + btn + ' utg ' + utg);
  });
  await check('Preflop: a Back Room player barely notices position; an Elite one does', async () => {
    const gap = async difficulty => (await freq(6, 0, 'Qd 8c', { difficulty }, ['raise','call'])) - (await freq(6, 3, 'Qd 8c', { difficulty }, ['raise','call']));
    const easy = await gap('easy'), elite = await gap('elite');
    assert.ok(elite > easy + 0.3, 'elite gap ' + elite + ' easy gap ' + easy);
  });
  await check('Preflop: weak players limp; strong players raise or fold', async () => {
    const limpEasy = await freq(6, 4, 'Kd Tc', { difficulty:'easy' }, ['call']);
    const limpElite = await freq(6, 4, 'Kd Tc', { difficulty:'elite' }, ['call']);
    assert.ok(limpEasy > 0.2 && limpElite < 0.05, 'easy ' + limpEasy + ' elite ' + limpElite);
  });
  await check('Preflop: facing an early raise, the Back Room calls lighter than the Casino', async () => {
    const opts = difficulty => ({ difficulty, raiseBy:[3, 60] });
    const easy = await freq(6, 0, 'Kd Jc', opts('easy'), ['call','raise']);
    const elite = await freq(6, 0, 'Kd Jc', opts('elite'), ['call','raise']);
    assert.ok(easy > elite + 0.25, 'easy ' + easy + ' elite ' + elite);
  });
  await check('Preflop: premium hands re-raise; a short stack shoves or folds, never limps', async () => {
    assert.ok(await freq(6, 0, 'Ks Kh', { raiseBy:[3, 60] }, ['raise']) > 0.8);
    const short = { stack: 160 };   // 8 big blinds
    for (const h of ['As 9d', '6c 5c', 'Qh Jd']){
      const limp = await freq(6, 0, h, short, ['call'], 60);
      assert.strictEqual(limp, 0, h + ' limped short');
    }
    assert.ok(await freq(6, 0, 'As 9d', short, ['raise']) > 0.9);
  });

  /* ---- postflop: lines, sizing, defence, timing ---- */
  await check('Range position: the nuts tops a range; air sits at the bottom of a tight one', () => {
    const board = 'Ah 7c 2s'.split(' ').map(C);
    assert.ok(A.rangeRelStrength('As Ad'.split(' ').map(C), board, 0.2) < 0.02);
    assert.ok(A.rangeRelStrength('9d 8c'.split(' ').map(C), board, 0.2) > 0.9);
    // top pair ranks better within a wide range than within a tight one
    const tp = 'Ad 9c'.split(' ').map(C);
    assert.ok(A.rangeRelStrength(tp, board, 1) < A.rangeRelStrength(tp, board, 0.05));
  });
  // heads-up postflop spot: hero (seat 1) acts on `board`; villain (seat 0,
  // the preflop raiser) has bet `bet` into `pot` (0 = checked to hero)
  function postflopSpot(hand, board, opts){
    opts = opts || {};
    const players = [0,1].map(i => ({ id:'p'+i, personality: A.PERSONALITIES_ALL.find(p=>p.key===(opts.key||'shark')),
      chips: 1000, hand: i === 1 ? hand.split(' ').map(C) : [], inHand:true, folded:false, allIn:false,
      betThisRound:0, totalBetHand:60, acted:false, mayRaise:true, moodState:null, eliminated:false }));
    const pot = opts.pot || 120, bet = opts.bet || 0;
    const g = { players, board: board.split(' ').map(C), pot: pot + bet, currentBet: bet, minRaise: Math.max(20, bet),
      bigBlind:20, dealerIndex:0, sbIndex:0, bbIndex:1, difficulty: opts.difficulty || 'elite', mode:'cash',
      phase: ['','','','flop','turn','river'][board.split(' ').length], pfRaises:1, pfAggressorId:'p0',
      prevAggressorId: 'p0', streetRaises: bet ? 1 : 0, streetAggressorId: bet ? 'p0' : null };
    if (bet){ players[0].betThisRound = bet; players[0].acted = true; }
    // the public action log the engine keeps (aiObserveAction): the villain's bet this street
    g.handLog = bet ? [{ id:'p0', n:g.board.length, a:'b' }] : [];
    return { g, me: players[1] };
  }
  async function pfreq(hand, board, opts, want, trials){
    let k = 0; const n = trials || 150;
    for (let t=0; t<n; t++){
      const { g, me } = postflopSpot(hand, board, opts);
      A.setGame(g);
      const d = await A.aiDecide(me, g);
      if (want.includes(d.action)) k++;
    }
    return k / n;
  }
  await check('Postflop: the nuts never folds; river air folds to a pot-sized bet', async () => {
    assert.strictEqual(await pfreq('Ks Qs', 'As Js Ts 4d 2c', { bet:120 }, ['fold']), 0);
    assert.ok(await pfreq('5d 4c', 'As Js Ts 9d 2c', { bet:120 }, ['fold']) > 0.9);
  });
  await check('Postflop: bottom pair calls a pot-sized river bet in the Back Room, rarely at Elite', async () => {
    // "I've got a pair!" vs "that's the bottom of my range"
    const spot = difficulty => ({ bet:120, difficulty });
    const easy = await pfreq('3s 4h', 'Kh 9s 7s 3d 2c', spot('easy'), ['call','raise'], 300);
    const elite = await pfreq('3s 4h', 'Kh 9s 7s 3d 2c', spot('elite'), ['call','raise'], 300);
    assert.ok(easy > elite + 0.15 && elite < 0.15, 'easy ' + easy + ' elite ' + elite);
  });
  await check('Postflop: a big draw semi-bluffs when checked to', async () => {
    // checked to hero on the turn: a flush + straight draw bets some of the time
    const draw = await pfreq('Qh Jh', '9h 8h 2c 3s', { difficulty:'elite', key:'maniac' }, ['bet'], 300);
    assert.ok(draw > 0.05, 'draw bets ' + draw);
  });
  await check('Think time: the Back Room pauses before a raise; Elite takes the same time either way', () => {
    A.setMotion(true);
    const { g, me } = postflopSpot('7d 6c', 'Kh 9s 7s', { bet:60 });
    A.setGame(g);
    const avg = (difficulty, d) => { g.difficulty = difficulty; let t = 0; for (let i=0;i<400;i++) t += A.aiThinkTime(me, d, g); return t/400; };
    const raise = { action:'raise', amount:300 }, call = { action:'call' };
    const easyGap = avg('easy', raise) / avg('easy', call), eliteGap = avg('elite', raise) / avg('elite', call);
    A.setMotion(false);
    assert.ok(easyGap > 1.5, 'easy raise/call time ' + easyGap.toFixed(2));
    assert.ok(Math.abs(eliteGap - 1) < 0.08, 'elite raise/call time ' + eliteGap.toFixed(2));
  });
  await check('Across a table: Elite bet sizes give nothing away and it reaches showdown less', async () => {
    const seats = ['maniac','professor','wildcard','shark'];
    const easy = summarize(await simulate({ seats, hands:250, difficulty:'easy', seed:8 }));
    const elite = summarize(await simulate({ seats, hands:250, difficulty:'elite', seed:8 }));
    const avg = (s, f) => seats.reduce((a, k) => a + s[k][f], 0) / seats.length;
    assert.ok(avg(elite, 'sizeTell') < 0.25 && avg(easy, 'sizeTell') > 0.45,
      'size tell easy ' + avg(easy, 'sizeTell').toFixed(2) + ' elite ' + avg(elite, 'sizeTell').toFixed(2));
    assert.ok(avg(elite, 'wtsd') < avg(easy, 'wtsd') - 0.08,
      'showdown easy ' + avg(easy, 'wtsd').toFixed(2) + ' elite ' + avg(elite, 'wtsd').toFixed(2));
  });

  /* ---- reads: the table's notebook, adaptation and tilt ---- */
  // a notebook that has watched seat `id` for `hands` hands with these rates
  function notebook(id, hands, rates){
    const r = { hands, vpip:0, pfr:0, postAgg:0, postPassive:0, facedBet:0, foldedToBet:0, cbetOpp:0, cbet:0, riverBetsShown:0, bluffsShown:0 };
    r.vpip = Math.round(hands * (rates.vpip ?? 0.3)); r.pfr = Math.round(hands * (rates.pfr ?? 0.18));
    const post = Math.round(hands * 0.6);
    r.postAgg = Math.round(post * (rates.agg ?? 0.3)); r.postPassive = post - r.postAgg;
    r.facedBet = Math.round(hands * 0.5); r.foldedToBet = Math.round(r.facedBet * (rates.ftb ?? 0.45));
    return { [id]: r };
  }
  await check('Reads: the notebook counts public actions and showdown bluffs', () => {
    const g = { players:[{ id:'a', inHand:true }, { id:'b', inHand:true }], board:[], pfAggressorId:null };
    A.aiObserveHandStart(g);
    A.aiObserveAction(g, g.players[0], 'raise', { toCall:10, raisesBefore:0, phase:'preflop' });
    A.aiObserveAction(g, g.players[0], 'raise', { toCall:40, raisesBefore:2, phase:'preflop' });   // still one VPIP, one PFR
    A.aiObserveAction(g, g.players[1], 'fold', { toCall:30, raisesBefore:0, phase:'flop' });
    g.pfAggressorId = 'a';
    A.aiObserveAction(g, g.players[0], 'bet', { toCall:0, raisesBefore:0, phase:'flop' });
    const r = g.reads;
    assert.deepStrictEqual([r.a.hands, r.a.vpip, r.a.pfr, r.a.postAgg, r.a.cbetOpp, r.a.cbet], [1, 1, 1, 1, 1, 1]);
    assert.deepStrictEqual([r.b.facedBet, r.b.foldedToBet], [1, 1]);
    // a river bettor who shows down air is noted as a bluff
    const sd = { players:[], board:'Kh 9s 7s 3d 2c'.split(' ').map(C), streetAggressorId:'a', reads:r };
    A.aiObserveShowdown(sd, [{ id:'a', hand:'5d 4c'.split(' ').map(C) }, { id:'b', hand:'Kd Qc'.split(' ').map(C) }]);
    assert.deepStrictEqual([r.a.riverBetsShown, r.a.bluffsShown], [1, 1]);
  });
  await check('Reads: saved counts restore sanitised, and only for players at the table', () => {
    const saved = { a: { hands:12, vpip:-3, pfr:'x', postAgg:4.5 }, ghost: { hands:99 } };
    const back = A.aiReadsRestore(saved, [{ id:'a' }]);
    assert.deepStrictEqual(Object.keys(back), ['a']);
    assert.deepStrictEqual([back.a.hands, back.a.vpip, back.a.pfr, back.a.postAgg], [12, 0, 0, 0]);
    assert.deepStrictEqual(A.aiReadsRestore(A.aiReadsSnapshot({ reads:back }), [{ id:'a' }]), back);
  });
  await check('Reads: the Back Room never notices; Elite trusts what it has seen, the Professor most', () => {
    const g = { difficulty:'easy', reads: notebook('bully', 60, { pfr:0.9, vpip:0.95 }) };
    const target = { id:'bully' };
    const who = key => ({ personality: A.PERSONALITIES_ALL.find(p=>p.key===key) });
    assert.strictEqual(A.aiReadOf(who('professor'), target, g).pfr, A.READ_PRIOR.pfr);
    g.difficulty = 'elite';
    const prof = A.aiReadOf(who('professor'), target, g).pfr, mavis = A.aiReadOf(who('station'), target, g).pfr;
    assert.ok(prof > 0.6 && mavis < 0.25, 'professor ' + prof.toFixed(2) + ' mavis ' + mavis.toFixed(2));
  });
  await check('Adapting: Elite defends wider against a known raise-everything player', async () => {
    const vs = async reads => {
      let k = 0;
      for (let t=0; t<200; t++){
        const { g, me } = preflopTable(6, 0, 'Kd 8c', { raiseBy:[3, 60] });
        if (reads) g.reads = notebook('p3', 80, { pfr:0.9, vpip:0.95 });
        A.setGame(g);
        const d = await A.aiDecide(me, g);
        if (d.action !== 'fold') k++;
      }
      return k / 200;
    };
    const unknown = await vs(false), known = await vs(true);
    assert.ok(known > unknown + 0.3, 'unknown ' + unknown + ' known bully ' + known);
  });
  await check('Adapting: Elite stops bluffing a player who never folds', async () => {
    const bluffs = async reads => {
      let k = 0;
      for (let t=0; t<400; t++){
        const { g, me } = postflopSpot('5d 4c', 'Kh 9s 7s 3d 2c', { difficulty:'elite', key:'shark' });
        if (reads) g.reads = notebook('p0', 80, { ftb:0.02 });
        A.setGame(g);
        const d = await A.aiDecide(me, g);
        if (d.action === 'bet') k++;
      }
      return k / 400;
    };
    const unknown = await bluffs(false), station = await bluffs(true);
    assert.ok(unknown > 0.03 && station < unknown * 0.25, 'river air bets: unknown ' + unknown + ' vs a station ' + station);
  });
  await check('Tilt: a steamed Tony plays looser; a steamed Elite Professor barely changes', async () => {
    const vpip = async (key, difficulty, steamed) => {
      let k = 0;
      for (let t=0; t<300; t++){
        const { g, me } = preflopTable(6, 4, 'Qd 7c', { key, difficulty });
        if (steamed) me.moodState = { kind:'steamed', intensity:1 };
        A.setGame(g);
        const d = await A.aiDecide(me, g);
        if (d.action !== 'fold') k++;
      }
      return k / 300;
    };
    const tony = (await vpip('maniac', 'medium', true)) - (await vpip('maniac', 'medium', false));
    const prof = (await vpip('professor', 'elite', true)) - (await vpip('professor', 'elite', false));
    assert.ok(tony > 0.15 && prof < tony / 2, 'tilt effect: tony +' + tony.toFixed(2) + ' professor +' + prof.toFixed(2));
  });

  /* ---- reading hands from the betting (Step 4) ---- */
  const eqVs = (hand, board, spec) => A.estimateEquityVsRanges(hand.split(' ').map(C), board.split(' ').map(C), [spec], 6000);
  await check('Hand reading: a bet-bet-raise line narrows a range toward monsters', () => {
    const board = 'Kh 8c 3d 7s 2h';
    const plain = eqVs('Kd Qc', board, { pct:0.3 });
    const line = [{ n:3, a:'b' }, { n:4, a:'b' }, { n:5, a:'r' }];
    const read = eqVs('Kd Qc', board, { pct:0.3, hist:line, bluff:1, k:1 });
    const blind = eqVs('Kd Qc', board, { pct:0.3, hist:line, bluff:1, k:0 });
    assert.ok(read < plain - 0.2, 'top pair vs the raw range ' + plain.toFixed(2) + ', vs the raising line ' + read.toFixed(2));
    assert.ok(Math.abs(blind - plain) < 0.03, 'a non-reader (k=0) does not narrow: ' + blind.toFixed(2));
  });
  await check('Hand reading: check-check caps a range; a known bluffer\'s bets count for less', () => {
    const board = 'Kh 8c 3d 7s';
    const plain = eqVs('8d 6c', board, { pct:0.3 });
    const capped = eqVs('8d 6c', board, { pct:0.3, hist:[{ n:3, a:'k' }, { n:4, a:'k' }], bluff:1, k:1 });
    assert.ok(capped > plain + 0.05, 'middle pair vs raw ' + plain.toFixed(2) + ', vs a checking range ' + capped.toFixed(2));
    const bets = [{ n:3, a:'b' }, { n:4, a:'b' }];
    const honest = eqVs('Kd 9c', board, { pct:0.3, hist:bets, bluff:1, k:1 });
    const bluffer = eqVs('Kd 9c', board, { pct:0.3, hist:bets, bluff:3, k:1 });
    assert.ok(bluffer > honest + 0.05, 'top pair vs an honest bettor ' + honest.toFixed(2) + ', vs a bluffer ' + bluffer.toFixed(2));
  });
  await check('Hand reading: Elite lays down top pair to a check-raise then two barrels; the Back Room pays it off', async () => {
    const spot = difficulty => {
      const s = postflopSpot('Kd 6c', 'Kh 8c 3d 7s 2h', { bet:300, pot:450, difficulty });
      s.g.handLog = [{ id:'p1', n:3, a:'b' }, { id:'p0', n:3, a:'r' }, { id:'p1', n:3, a:'c' },
                     { id:'p0', n:4, a:'b' }, { id:'p1', n:4, a:'c' }, { id:'p0', n:5, a:'b' }];
      return s;
    };
    const calls = async difficulty => {
      let k = 0;
      for (let t=0; t<200; t++){ const { g, me } = spot(difficulty); A.setGame(g); const d = await A.aiDecide(me, g); if (d.action !== 'fold') k++; }
      return k / 200;
    };
    const easy = await calls('easy'), elite = await calls('elite');
    assert.ok(elite < 0.35 && easy > elite + 0.25, 'calls: easy ' + easy + ' elite ' + elite);
  });

  await check('Every Career event difficulty has a tier target', () => {
    const modes = fs.readFileSync(path.join(__dirname, '..', 'js/04-modes-and-scoring.js'), 'utf8');
    const used = new Set([...modes.matchAll(/difficulty:'(\w+)'/g)].map(m => m[1]));
    used.forEach(d => {
      assert.ok(TIER_TARGETS[d], 'no tier target for ' + d);
      assert.ok(A.DIFFICULTY_PARAMS[d], 'no DIFFICULTY_PARAMS for ' + d);
    });
  });

  await check('Test seats only ever choose legal action names', () => {
    A.setGame(null);
    const deck = A.shuffle(A.createDeck());
    const p = { hand:[deck[0], deck[1]], betThisRound:0 };
    const g = { board:[deck[2], deck[3], deck[4]], pot:120, currentBet:40, bigBlind:20, players:[p, { folded:false }] };
    Object.values(PROBES).forEach(fn => {
      const d = fn(p, g, A);
      assert.ok(['fold','check','call','bet','raise'].includes(d.action), d.action);
    });
  });

  const opts = { seats:['maniac','professor','probe:abc'], hands:10, difficulty:'medium', seed:42 };
  const run1 = await simulate(opts);
  await check('Measuring table conserves chips and counts sanely', () => {
    assert.ok(run1.chipsError < 1e-9, 'chips error ' + run1.chipsError);
    Object.values(run1.stats).forEach(s => {
      assert.strictEqual(s.hands, 10);
      assert.ok(s.pfr <= s.vpip && s.vpip <= s.hands);
      assert.ok(s.wtsd <= s.sawFlop && s.foldToBet <= s.facedBet && s.cbet <= s.cbetOpp);
    });
    const net = Object.values(run1.stats).reduce((a, s) => a + s.net, 0);
    assert.ok(Math.abs(net) < 1e-6, 'net chips across seats ' + net);
  });
  await check('Measuring table is repeatable from a seed', async () => {
    const run2 = await simulate(opts);
    assert.deepStrictEqual(summarize(run2), summarize(run1));
  });

  process.stdout.write('\n' + passed + ' AI behaviour checks passed\n');
})().catch(e => { console.error(e); process.exit(1); });
