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
