#!/usr/bin/env node
"use strict";
/* Event simulator: whole Career events, played to the end.

   ai-sim.js measures single hands with every stack reset. This plays an
   event the way the game does: stacks carry over, the blinds rise on the
   event's own schedule, players bust, and places are paid from the
   event's own payout table. "You" are played by the game's own AI at a
   chosen skill (a stand-in for a player of that strength), or by the
   plain probe:abc seat. Used for docs/career/EVENTS_PLAN.md.

   node validation/tools/event-sim.js <event-id> [options]
     --you L          who plays you: skills 0-100 and/or "abc", comma
                      separated (default 30,50,80)
     --events N       events per player (default 600)
     --stack N        starting stack instead of the event's
     --per-level N    hands per blind level instead of the event's
     --skill N        the table's AI skill (0-100) instead of the event's
     --players N      seats including you, instead of the event's
     --payouts a,b    prize per place instead of the event's
     --buy-in N       entry instead of the event's
     --seed N         repeatable run (default 1)
     --json           machine-readable output

   Example, the Back Room 3-HAND at 50 big blinds and slower blinds:
     node validation/tools/event-sim.js back-room-freezeout --stack 1000 --per-level 15

   Slow by design (the real Monte-Carlo equity); runs on every CPU. */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { loadAI, seeded, PROBES } = require('./ai-harness');

const ROOT = path.resolve(__dirname, '../..');

/* The event catalogue and blind ladder, read from the game itself. */
function loadEvents(){
  const src = fs.readFileSync(path.join(ROOT, 'js/04-modes-and-scoring.js'), 'utf8');
  const body = src.slice(src.indexOf('const BLIND_LEVELS'), src.indexOf('function careerRosterSeats'));
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(body + '\nglobalThis.OUT = { BLIND_LEVELS, CAREER_EVENT_LIST };', ctx);
  return ctx.OUT;
}

/* The game's own draw (pickPersonalities): the four preferred
   personalities first, topped up from the rest; a curated roster wins. */
function drawRoster(A, event, seats, rnd){
  const all = A.PERSONALITIES_ALL;
  if (Array.isArray(event.rosterKeys) && event.rosterKeys.length === seats)
    return event.rosterKeys.map(k => all.find(p => p.key === k));
  const shuffle = a => { for (let i = a.length-1; i > 0; i--){ const j = Math.floor(rnd()*(i+1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const preferred = shuffle(all.filter(p => ['maniac','professor','wildcard','shark'].includes(p.key)));
  const rest = shuffle(all.filter(p => !preferred.includes(p)));
  return preferred.concat(rest).slice(0, seats);
}

async function playEvent(A, rnd, cfg, you){
  const persona = drawRoster(A, cfg.event, cfg.players - 1, rnd);
  const youProbe = you === 'abc' ? 'abc' : null;
  const youPersona = youProbe
    ? { key:'you', aggression:.5, tightness:.5, bluffFreq:0, sizing:.7, thinkSpeed:1 }
    : A.PERSONALITIES_ALL.find(p => p.key === 'grinder');   // a solid, unshowy style
  const seat = (pers, i, extra) => Object.assign({ id:'s'+i, name:pers.key, key:pers.key, personality:pers,
    chips:cfg.stack, isHuman:false, probe:null, eliminated:false, moodState:null }, extra);
  const all = [seat(youPersona, 0, { you:true, isHuman:!!youProbe, probe:youProbe, skill: youProbe ? undefined : you })]
    .concat(persona.map((p, i) => seat(p, i+1, {})));
  const reads = {};
  const order = [];            // bust order, worst place first
  let button = 0, hands = 0, aiFirst = null, youShare = null;

  while (all.filter(p => p.chips > 0).length > 1 && hands < 1000){
    const players = all.filter(p => p.chips > 0);
    const n = players.length;
    if (n === 2 && youShare === null && players.some(p => p.you))
      youShare = players.find(p => p.you).chips / players.reduce((a, p) => a + p.chips, 0);
    const [sb, bb] = cfg.levels[Math.min(cfg.levels.length-1, cfg.firstLevel + Math.floor(hands / cfg.perLevel))];
    hands++;
    const dealer = button++ % n;
    const g = { players, board:[], pot:0, currentBet:0, minRaise:bb, bigBlind:bb, smallBlind:sb,
      dealerIndex:dealer, difficulty:cfg.event.difficulty, mode:'career', reads, event:cfg.event };
    if (typeof cfg.skill === 'number') g.skill = cfg.skill;
    A.setGame(g);
    const deck = A.shuffle(A.createDeck()); let di = 0;
    const startChips = new Map(players.map(p => [p, p.chips]));
    players.forEach(p => Object.assign(p, { hand:[deck[di++], deck[di++]], inHand:true, folded:false, allIn:false,
      betThisRound:0, totalBetHand:0, acted:false, mayRaise:true }));
    const commit = (p, amt) => { amt = Math.min(amt, p.chips); p.chips -= amt; p.betThisRound += amt;
      p.totalBetHand += amt; g.pot += amt; if (p.chips === 0) p.allIn = true; return amt; };
    const sbI = n === 2 ? dealer : (dealer+1) % n;
    const bbI = n === 2 ? (dealer+1) % n : (dealer+2) % n;
    commit(players[sbI], sb); commit(players[bbI], bb);
    g.currentBet = bb; g.sbIndex = sbI; g.bbIndex = bbI;
    A.aiObserveHandStart(g);
    const live = () => players.filter(p => !p.folded);

    for (const street of ['preflop','flop','turn','river']){
      g.prevAggressorId = street === 'preflop' ? null : (g.streetAggressorId || null);
      g.phase = street; g.streetRaises = 0; g.streetAggressorId = null;
      if (street === 'preflop'){ g.pfAggressorId = null; g.pfRaises = 0; }
      if (street === 'flop') g.board.push(deck[di++], deck[di++], deck[di++]);
      else if (street !== 'preflop') g.board.push(deck[di++]);
      if (street !== 'preflop'){
        players.forEach(p => { p.betThisRound = 0; p.acted = false; p.mayRaise = true; });
        g.currentBet = 0; g.minRaise = bb;
      }
      let ptr = street === 'preflop' ? (bbI+1) % n : (dealer+1) % n;
      for (let guard = 0; guard < 500; guard++){
        if (live().length <= 1) break;
        const actors = players.filter(p => !p.folded && !p.allIn);
        const needs = p => !p.acted || p.betThisRound < g.currentBet;
        if (!actors.some(needs)) break;
        if (actors.length === 1 && actors[0].betThisRound >= g.currentBet) break;
        const p = players[ptr]; ptr = (ptr+1) % n;
        if (p.folded || p.allIn || !needs(p)) continue;
        const toCall = g.currentBet - p.betThisRound, raisesBefore = g.streetRaises;
        let d = p.probe ? PROBES[p.probe](p, g, A) : await A.aiDecide(p, g);
        if ((d.action === 'raise' || d.action === 'bet') && (!p.mayRaise || p.chips <= toCall)) d = { action:'call' };
        let applied;
        if (d.action === 'fold'){ p.folded = true; applied = 'fold'; }
        else if (d.action === 'check' || (d.action === 'call' && toCall <= 0)) applied = 'check';
        else if (d.action === 'call'){ commit(p, toCall); applied = 'call'; }
        else {
          const prev = g.currentBet;
          let target = prev <= 0 ? Math.max(d.amount, p.betThisRound + bb) : Math.max(d.amount, prev + g.minRaise);
          target = Math.min(target, p.betThisRound + p.chips);
          commit(p, target - p.betThisRound);
          const inc = p.betThisRound - prev;
          if (inc > 0){
            const full = inc >= g.minRaise;
            g.currentBet = p.betThisRound; g.streetRaises++; g.streetAggressorId = p.id;
            if (street === 'preflop'){ g.pfAggressorId = p.id; g.pfRaises = g.streetRaises; }
            players.forEach(q => { if (q === p || q.folded || q.allIn) return;
              if (full){ q.acted = false; q.mayRaise = true; } else if (q.acted) q.mayRaise = false; });
            if (full) g.minRaise = inc;
          }
          applied = prev > 0 ? 'raise' : 'bet';
        }
        p.acted = true;
        A.aiObserveAction(g, p, applied, { toCall, raisesBefore, phase: street });
      }
      if (live().length <= 1) break;
    }

    // Showdown, paid layer by layer (side pots).
    const L = live(), rank = new Map();
    if (L.length > 1){
      while (g.board.length < 5) g.board.push(deck[di++]);
      A.aiObserveShowdown(g, L);
      L.forEach(p => rank.set(p, A.evaluate7([...p.hand, ...g.board])));
    }
    const layers = [...new Set(players.map(p => p.totalBetHand).filter(x => x > 0))].sort((a, b) => a - b);
    let below = 0;
    for (const level of layers){
      const inLayer = players.filter(p => p.totalBetHand >= level);
      const amount = (level - below) * inLayer.length; below = level;
      const eligible = inLayer.filter(p => !p.folded);
      let winners = eligible.length ? eligible : L;
      if (winners.length > 1){
        let best = rank.get(winners[0]);
        winners.forEach(p => { if (A.compareHands(rank.get(p), best) > 0) best = rank.get(p); });
        winners = winners.filter(p => A.compareHands(rank.get(p), best) === 0);
      }
      const share = Math.floor(amount / winners.length);
      winners.forEach(p => { p.chips += share; });
      winners[0].chips += amount - share * winners.length;
    }
    const total = all.reduce((a, p) => a + p.chips, 0);
    if (total !== cfg.stack * cfg.players) throw new Error('event-sim: chips ' + total + ' after hand ' + hands);

    // Busts this hand: the bigger starting stack finishes higher.
    const out = players.filter(p => p.chips === 0).sort((a, b) => startChips.get(a) - startChips.get(b));
    if (out.length && aiFirst === null) aiFirst = !out.some(p => p.you);
    order.push(...out);
  }
  const places = all.filter(p => p.chips > 0).concat(order.slice().reverse());
  return { place: places.findIndex(p => p.you) + 1, hands, aiFirst, youShare };
}

if (!isMainThread){
  (async () => {
    const w = workerData;
    const A = loadAI(w.seed);
    const rnd = seeded(w.seed + 7);
    const out = [];
    for (let i = 0; i < w.n; i++) out.push(await playEvent(A, rnd, w.cfg, w.you));
    parentPort.postMessage(out);
  })();
  return;
}

function arg(name, fallback){
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i+1] !== undefined ? process.argv[i+1] : fallback;
}

(async () => {
  const id = process.argv[2];
  const { BLIND_LEVELS, CAREER_EVENT_LIST } = loadEvents();
  const event = CAREER_EVENT_LIST.find(e => e.id === id);
  if (!event){
    console.error('event-sim: give an event id: ' + CAREER_EVENT_LIST.map(e => e.id).join(', '));
    process.exit(1);
  }
  const num = (v, d) => v === undefined ? d : Number(v);
  const cfg = {
    event: JSON.parse(JSON.stringify(event)),
    levels: BLIND_LEVELS, firstLevel: event.initialBlindLevel,
    stack: num(arg('stack'), event.stack),
    perLevel: num(arg('per-level'), event.handsPerBlindLevel),
    skill: arg('skill') === undefined ? undefined : Number(arg('skill')),
    players: num(arg('players'), event.playerCount),
  };
  const payouts = arg('payouts') ? arg('payouts').split(',').map(Number) : event.payouts.slice();
  const buyIn = num(arg('buy-in'), event.buyIn);
  const N = num(arg('events'), 600);
  const seed = num(arg('seed'), 1);
  const yous = String(arg('you', '30,50,80')).split(',').map(s => s === 'abc' ? 'abc' : Number(s));

  const results = [];
  for (const you of yous){
    const W = Math.max(1, Math.min(os.cpus().length, Math.ceil(N / 20)));
    const per = Math.ceil(N / W);
    const parts = await Promise.all(Array.from({ length: W }, (_, i) => new Promise((res, rej) => {
      const w = new Worker(__filename, { workerData: { cfg, you, n: per, seed: seed*1000 + i } });
      w.once('message', res); w.once('error', rej);
    })));
    const r = parts.flat();
    const k = r.length;
    const placeShare = q => r.filter(x => x.place === q).length / k;
    const net = r.reduce((a, x) => a + (payouts[x.place-1] || 0), 0) / k - buyIn;
    const aiFirst = r.filter(x => x.aiFirst);
    const behind = aiFirst.filter(x => x.youShare !== null && x.youShare < 0.4);
    results.push({
      you: you === 'abc' ? 'abc' : 'skill ' + you, events: k,
      win: placeShare(1), cash: r.filter(x => payouts[x.place-1] > 0).length / k,
      places: Array.from({ length: cfg.players }, (_, i) => placeShare(i+1)),
      netPerEvent: net, hands: r.reduce((a, x) => a + x.hands, 0) / k,
      aiKnocksOutFirst: aiFirst.length / k,
      winFromBehindHeadsUp: behind.length ? behind.filter(x => x.place === 1).length / behind.length : null,
    });
  }

  const table = {
    event: id, players: cfg.players, stack: cfg.stack, bigBlind: BLIND_LEVELS[cfg.firstLevel][1],
    perLevel: cfg.perLevel, aiSkill: cfg.skill !== undefined ? cfg.skill : event.skill !== undefined ? event.skill : event.difficulty,
    buyIn, payouts, results,
  };
  if (process.argv.includes('--json')){ console.log(JSON.stringify(table, null, 2)); return; }
  const pct = x => x === null ? '  -' : (Math.round(x*100) + '%').padStart(4);
  console.log('\n== ' + id + ' · ' + cfg.players + ' players · ' + cfg.stack + ' chips (' +
    Math.round(cfg.stack / table.bigBlind) + ' bb) · blinds up every ' + cfg.perLevel + ' hands · AI ' +
    table.aiSkill + ' · $' + buyIn + ' in, pays ' + payouts.map(p => '$' + p).join('/'));
  console.log('you         win  cash  $/event  hands  places 1st..last          AI KOs first  win from behind HU');
  for (const x of results){
    console.log(x.you.padEnd(10) + pct(x.win) + '  ' + pct(x.cash) + '  ' + ((x.netPerEvent >= 0 ? '+' : '') +
      Math.round(x.netPerEvent)).padStart(6) + '  ' + String(Math.round(x.hands)).padStart(5) + '  ' +
      x.places.map(pct).join(' ').padEnd(26) + pct(x.aiKnocksOutFirst).padStart(12) + pct(x.winFromBehindHeadsUp).padStart(19));
  }
})().catch(e => { console.error(e); process.exit(1); });
