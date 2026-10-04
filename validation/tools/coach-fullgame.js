"use strict";
/* P.I.P. in full games (docs/coach/BRAIN_PLAN.md, "The accuracy audit").

   Plays COMPLETE games, first hand to last, the way the owner plays them:
   stacks carry over from hand to hand (so they go uneven), the blinds go
   up every 10 hands (the game's own BLIND_LEVELS), players go all in, side
   pots form, players are knocked out. The opponents are the game's real AI
   (js/03-opponents.js aiDecide), pots are split by the game's real
   computePots (js/05-game-engine.js), hands by the real evaluator, and the
   betting bookkeeping is the engine's applyAction, line for line.

   You ("you") are played by a mix: mostly P.I.P.'s own advice, sometimes a
   random legal move (so the odd spots, all ins included, come up too).

   At EVERY one of your decisions, and at the end of every hand, his brain
   is checked against answers worked out here INDEPENDENTLY of it (the
   AUDIT list below). Any disagreement is recorded with the hand, so it can
   be read and understood.

   Usage:
     node validation/tools/coach-fullgame.js [games] [seed]
   Used by validation/coach-fullgame-checks.js (a smaller seeded run). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');

function seeded(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* the real maths, AI, pot split and P.I.P.'s brain in one sandbox */
function load(seed){
  const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const math = read('js/01-poker-math.js');
  const modes = read('js/04-modes-and-scoring.js');
  const engine = read('js/05-game-engine.js');
  const elim = modes.slice(modes.indexOf('const ELIMINATION_CONFIG'));
  const levels = modes.slice(modes.indexOf('const BLIND_LEVELS'), modes.indexOf('];', modes.indexOf('const BLIND_LEVELS')) + 2);
  const pots = engine.slice(engine.indexOf('function computePots('), engine.indexOf('\n}\n', engine.indexOf('function computePots(')) + 3);
  const SandMath = Object.create(Math);
  SandMath.random = seeded(seed);
  const ctx = { console, Math:SandMath, setTimeout, clearTimeout,
    settings:{ tableTalk:false, speed:'normal' }, seatEls:{}, FACE_MOOD_POOLS:{},
    DEV_MODE:false, FAST_DEV:false, quickResolveActive:() => false, motionOff:() => true };
  vm.createContext(ctx);
  const inlineEquity = math.replace(/const EquityService = \(function\(\)\{[\s\S]*?\n\}\)\(\);/,
    'const EquityService = { get: async (h,b,n,i,r) => r ? estimateEquityVsRanges(h,b,r,i) : estimateEquity(h,b,n,i) };');
  vm.runInContext('var game = null;\n' + inlineEquity + '\n' + levels + '\n' + elim.slice(0, elim.indexOf('\n};') + 3) + '\n' +
    read('js/03-opponents.js') + '\n' + pots + '\n' + read('js/coach-brain.js') + '\n' + read('js/coach-lines.js') +
    '\nglobalThis.API = { aiDecide, PERSONALITIES_ALL, createDeck, shuffle, evaluate7, compareHands, computePots, BLIND_LEVELS,' +
    ' aiObserveHandStart, aiObserveAction, aiObserveShowdown, describePlayerHand, CoachBrain, CoachLines, setGame: g => { game = g; } };', ctx);
  return ctx.API;
}

/* ---------------- the independent answers ----------------
   Written here from the rules, not from the brain. */

// what you'd have to put in to call, and the most you could win by calling:
// every pot you'd be eligible for once your call is in (the game's own
// computePots over a copy of the table), your own chips included
function truePrice(g, me){
  const call = Math.min(Math.max(0, g.currentBet - me.betThisRound), me.chips);
  const copy = g.players.map(p => ({ id:p.id, folded:p.folded || !p.inHand, totalBetHand:(p.totalBetHand || 0) + (p === me ? call : 0) }));
  const pots = API.computePots(copy);
  const winnable = pots.filter(p => p.eligible.includes(me.id)).reduce((s, p) => s + p.amount, 0);
  return { call, winnable, odds: call > 0 ? call / winnable : 0 };
}
// the legal moves in front of you (the engine's rules)
function legalMoves(g, me){
  const toCall = Math.max(0, g.currentBet - me.betThisRound);
  const others = g.players.filter(p => p !== me && p.inHand && !p.folded);
  // a bet or raise needs someone who could still call it
  const canRespond = others.some(p => !p.allIn && p.chips > 0);
  const moves = new Set(toCall > 0 ? ['fold', 'call'] : ['check']);
  if (me.mayRaise !== false && me.chips > toCall){ moves.add('raise'); moves.add('allin'); moves.add('bet'); }
  if (toCall > 0 && me.chips <= toCall) moves.add('allin');   // a call for everything you have
  return { moves, toCall, canRespond };
}

let API = null;
const HERO = 'you';

async function playGame(opts, R, audit, log){
  const nOpp = opts.opponents;
  const pers = API.PERSONALITIES_ALL;
  const stackStart = opts.stack;
  const players = [{ id:HERO, name:'You', isHuman:true, chips:stackStart }]
    .concat(Array.from({ length:nOpp }, (_, i) => {
      const p = pers[Math.floor(R() * pers.length)];
      return { id:'p' + i, name:['Tony','Roxy','Lucy','Harry','Mavis','Nigel'][i], key:p.key, personality:p, chips:stackStart };
    }));
  players.forEach(p => Object.assign(p, { hand:[], inHand:true, folded:false, allIn:false, eliminated:false,
    betThisRound:0, totalBetHand:0, acted:false, mayRaise:true }));
  const reads = {};
  let dealer = Math.floor(R() * players.length);
  const B = API.CoachBrain;
  B.reset && B.reset();
  let handNumber = 0;

  for (let hand = 0; hand < opts.maxHands; hand++){
    const seated = players.filter(p => !p.eliminated);
    if (seated.length < 2 || players[0].eliminated) break;
    handNumber++;
    const lvl = Math.min(API.BLIND_LEVELS.length - 1, Math.floor((handNumber - 1) / 10));
    const [sbAmt, bb] = API.BLIND_LEVELS[lvl];
    // the button moves to the next seated player
    do { dealer = (dealer + 1) % players.length; } while (players[dealer].eliminated);
    const g = { players, board:[], pot:0, currentBet:0, minRaise:bb, bigBlind:bb, smallBlind:sbAmt, dealerIndex:dealer,
      difficulty:opts.difficulty, mode:'tournament', reads, handNumber, handActions:[], handLog:[], streetRaises:0, pfRaises:0, pfAggressorId:null };
    API.setGame(g);
    const deck = API.shuffle(API.createDeck()); let di = 0;
    players.forEach(p => Object.assign(p, { hand: p.eliminated ? [] : [deck[di++], deck[di++]], inHand:!p.eliminated,
      folded:false, allIn:false, betThisRound:0, totalBetHand:0, acted:false, mayRaise:true }));
    const next = i => { let j = i; do { j = (j + 1) % players.length; } while (!players[j].inHand); return j; };
    const n = seated.length;
    const sbI = n === 2 ? dealer : next(dealer), bbI = next(sbI);
    g.sbIndex = sbI; g.bbIndex = bbI;
    const commit = (p, amt) => { amt = Math.min(amt, p.chips); p.chips -= amt; p.betThisRound += amt; p.totalBetHand += amt; g.pot += amt; if (p.chips === 0) p.allIn = true; return amt; };
    commit(players[sbI], sbAmt); commit(players[bbI], bb); g.currentBet = bb;
    const startChips = {}; players.forEach(p => { startChips[p.id] = p.chips + p.totalBetHand; });
    API.aiObserveHandStart(g);
    B.handStart(g, startChips);
    const live = () => players.filter(p => p.inHand && !p.folded);
    const H = { n:handNumber, bb, decisions:[], log:[] };

    for (const street of ['preflop', 'flop', 'turn', 'river']){
      g.phase = street;
      if (street === 'flop') g.board.push(deck[di++], deck[di++], deck[di++]);
      else if (street !== 'preflop') g.board.push(deck[di++]);
      // beginBettingRound
      players.forEach(p => { p.acted = false; p.mayRaise = true; });
      if (street !== 'preflop'){ players.forEach(p => { p.betThisRound = 0; }); g.currentBet = 0; g.minRaise = bb; }
      g.prevAggressorId = street === 'preflop' ? null : (g.streetAggressorId || null);
      g.streetRaises = 0; g.streetAggressorId = null;
      if (street === 'preflop'){ g.pfAggressorId = null; g.pfRaises = 0; }
      let ptr = street === 'preflop' ? (n === 2 ? dealer : next(bbI)) : (n === 2 ? bbI : next(dealer));
      for (let guard = 0; guard < 400; guard++){
        if (live().length <= 1) break;
        const actors = live().filter(p => !p.allIn);
        const needs = p => !p.acted || p.betThisRound < g.currentBet;
        if (!actors.some(needs)) break;
        if (actors.length === 1 && actors[0].betThisRound >= g.currentBet && live().length > 1) break;
        const p = players[ptr]; ptr = next(ptr);
        if (p.folded || p.allIn || !needs(p)) continue;
        const toCall = g.currentBet - p.betThisRound;
        let d, sp = null, adv = null;
        if (p.id === HERO){
          sp = B.spot(g, p);
          adv = B.advise(sp);
          checkSpot(g, p, sp, adv, audit, H);
          d = heroMove(g, p, sp, adv, R, opts.follow);
        } else {
          d = await API.aiDecide(p, g);
        }
        applyAction(g, p, d, toCall);
        if (p.id === HERO){
          const rec = B.record(sp, g, p);
          checkChoice(g, p, sp, adv, rec, audit, H);
        }
      }
      if (live().length <= 1) break;
    }
    // the end: run out the board, split the pots the game's way
    const L = live();
    let showdown = false;
    if (L.length > 1){ while (g.board.length < 5) g.board.push(deck[di++]); g.phase = 'showdown'; showdown = true; API.aiObserveShowdown(g, L); }
    else g.phase = 'foldwin';
    const heroBefore = players[0].chips;
    // what P.I.P. works out the moment the winner is shown (before the pot is paid)
    let settled = null;
    try{ settled = B.settle(g, players[0]); }catch(e){ settled = 'ERR ' + e.message; }
    const pots = API.computePots(players.map(p => ({ id:p.id, folded:p.folded || !p.inHand, totalBetHand:p.totalBetHand })));
    const won = {};
    pots.forEach(pot => {
      const el = players.filter(p => pot.eligible.includes(p.id));
      let winners = el;
      if (el.length > 1){
        const ev = el.map(p => [p, API.evaluate7([...p.hand, ...g.board])]);
        let best = ev[0][1]; ev.forEach(e => { if (API.compareHands(e[1], best) > 0) best = e[1]; });
        winners = ev.filter(e => API.compareHands(e[1], best) === 0).map(e => e[0]);
      }
      const share = Math.floor(pot.amount / winners.length);
      let odd = pot.amount - share * winners.length;
      winners.forEach(w => { won[w.id] = (won[w.id] || 0) + share + (odd-- > 0 ? 1 : 0); });
    });
    Object.entries(won).forEach(([id, amt]) => { players.find(p => p.id === id).chips += amt; });
    const net = players[0].chips - startChips[HERO];
    const inThisHand = startChips[HERO] > 0 && players[0].hand.length;
    if (inThisHand){
      if (typeof settled === 'number' && settled !== net) audit('settle', 'his result (' + settled + ') differs from what the pots paid (' + net + ')', H);
      if (typeof settled !== 'number' && settled !== null) audit('settle', 'his result: ' + settled, H);
      const done = B.handEnd(g, players[0], net);
      checkEnd(g, players, done, net, startChips, audit, H);
    }
    players.forEach(p => { if (!p.eliminated && p.chips <= 0) p.eliminated = true; });
    log.hands++;
  }
  log.games++;
  if (players[0].eliminated) log.heroOut++;
}

/* the engine's applyAction, the bookkeeping only (js/05-game-engine.js) */
function applyAction(g, player, decision, toCall){
  const raisesBefore = g.streetRaises || 0;
  let action = decision.action;
  const commitTo = t => { let need = t - player.betThisRound; if (need >= player.chips) need = player.chips; player.chips -= need; player.betThisRound += need; player.totalBetHand += need; g.pot += need; if (player.chips === 0) player.allIn = true; return need; };
  const settle = prev => {
    const inc = player.betThisRound - prev; if (inc <= 0) return;
    const full = inc >= g.minRaise;
    g.currentBet = player.betThisRound; g.streetRaises = (g.streetRaises || 0) + 1; g.streetAggressorId = player.id;
    if (g.phase === 'preflop'){ g.pfAggressorId = player.id; g.pfRaises = g.streetRaises; }
    g.players.forEach(p => { if (p === player || !p.inHand || p.folded || p.allIn) return; if (full){ p.acted = false; p.mayRaise = true; } else if (p.acted) p.mayRaise = false; });
    if (full) g.minRaise = inc;
  };
  if ((action === 'raise' || action === 'bet') && (player.mayRaise === false || player.chips <= toCall)) action = toCall > 0 ? 'call' : 'check';
  if (action === 'fold') player.folded = true;
  else if (action === 'check'){ if (toCall > 0) { player.folded = true; action = 'fold'; } }
  else if (action === 'call'){ const amt = commitTo(g.currentBet); if (!(amt > 0)) action = 'check'; }
  else {
    const prev = g.currentBet;
    let target = action === 'allin' ? player.betThisRound + player.chips : prev <= 0 ? Math.max(decision.amount || 0, player.betThisRound + g.bigBlind) : Math.max(decision.amount || 0, prev + g.minRaise);
    if (target > player.betThisRound + player.chips) target = player.betThisRound + player.chips;
    commitTo(target); settle(prev);
    action = prev <= 0 ? 'bet' : 'raise';
  }
  player.acted = true;
  API.aiObserveAction(g, player, action, { toCall, raisesBefore, phase:g.phase });
  g.handActions.push({ id:player.id, name:player.name, street:g.phase, action, amount:player.betThisRound });
}

/* your move: mostly his advice, sometimes a random legal one */
function heroMove(g, me, sp, adv, R, follow){
  const toCall = Math.max(0, g.currentBet - me.betThisRound);
  if (adv && R() < follow){
    const m = adv.move === 'bet' ? 'raise' : adv.move;
    return { action:m, amount:adv.to || 0 };
  }
  const opts = toCall > 0 ? ['fold', 'call', 'call'] : ['check', 'check'];
  if (me.mayRaise !== false && me.chips > toCall) opts.push('raise', 'allin');
  const a = opts[Math.floor(R() * opts.length)];
  const pot = g.pot;
  return { action:a, amount: a === 'raise' ? g.currentBet + Math.max(g.minRaise, Math.round(pot * (0.4 + R()))) : 0 };
}

/* ---------------- THE AUDIT: what must always be true ---------------- */
const MADE_OF = { 'Royal Flush':'straight-flush', 'Straight Flush':'straight-flush', 'Four of a Kind':'quads', 'Full House':'full-house', Flush:'flush', Straight:'straight', 'Three of a Kind':'three', 'Two Pair':'two-pair', 'One Pair':'pair', Pair:'pair', 'High Card':'nothing' };
function checkSpot(g, me, sp, adv, audit, H){
  if (!sp){ audit('spot', 'no read of your decision', H); return; }
  const tp = truePrice(g, me);
  H.last = { street:g.phase, board:g.board.map(c => c.rank + c.suit).join(' '), hole:me.hand.map(c => c.rank + c.suit).join(' '),
    stacks:g.players.filter(p => p.inHand && !p.folded).map(p => p.name + ' ' + p.chips + '+' + p.betThisRound + (p.allIn ? ' ALLIN' : '')).join(', '),
    pot:g.pot, toCall:tp.call, winnable:tp.winnable };
  // A1 the price of a call: what you'd put in against what you could win
  if (tp.call > 0 && Math.abs(sp.potOdds - tp.odds) > 0.005)
    audit('price', 'the price of a call: he says you need ' + Math.round(sp.potOdds * 100) + '%, it is ' + Math.round(tp.odds * 100) + '% (' + tp.call + ' to win ' + tp.winnable + ')', H);
  if (sp.toCall !== tp.call) audit('call-amount', 'the call: he says ' + sp.toCall + ', it is ' + tp.call, H);
  // A2 the effective stack: the most you can win or lose this hand
  const mine = me.chips + me.betThisRound;
  const others = g.players.filter(p => p !== me && p.inHand && !p.folded).map(p => p.chips + p.betThisRound);
  const eff = Math.min(mine, Math.max(...others)) / g.bigBlind;
  if (Math.abs(sp.effectiveBB - eff) > 0.06) audit('effective', 'effective stack ' + sp.effectiveBB + ' big blinds, it is ' + eff.toFixed(1), H);
  if (sp.shortBy && !(Math.max(...others) < mine)) audit('short-by', 'says ' + sp.shortBy + ' is short, but you do not cover them', H);
  // A3 your made hand, against the evaluator
  if (sp.board.length >= 3 && sp.boardFacts){
    const name = API.describePlayerHand(me.hand, g.board) || '';
    if (sp.boardFacts.handName && name && sp.boardFacts.handName !== name && !sp.boardFacts.boardPlays)
      audit('hand-name', 'your hand: he says "' + sp.boardFacts.handName + '", the game says "' + name + '"', H);
  }
  if (!adv) return;
  // A4 advice is a move you have, and a sensible one
  const L = legalMoves(g, me);
  const mv = adv.move === 'bet' ? 'raise' : adv.move;
  if (!L.moves.has(mv)) audit('illegal-advice', 'advises ' + adv.move + ' (you can: ' + [...L.moves].join('/') + ')', H);
  if ((mv === 'raise' || mv === 'allin') && !L.canRespond && L.toCall > 0 && !(me.chips <= L.toCall))
    audit('raise-nobody', 'advises ' + adv.move + ' when nobody left can call it', H);
  if (mv === 'raise' && adv.to != null && (adv.to > mine || adv.to < Math.min(mine, g.currentBet + g.minRaise)))
    audit('size', 'advises a raise to ' + adv.to + ' (legal: ' + Math.min(mine, g.currentBet + g.minRaise) + ' to ' + mine + ')', H);
  // A5 the numbers he quotes about the price agree with the true price
  const n = adv.n || {};
  if (tp.call > 0 && n.odds != null && Math.abs(n.odds - Math.round(tp.odds * 100)) > 1)
    audit('quoted-price', 'quotes ' + n.odds + '% for the price; it is ' + Math.round(tp.odds * 100) + '%', H);
  // A6 advice to call must be worth it on his OWN chance of winning at the true price
  // (his equity is an estimate against a range: that part is judgement; the price is a fact)
  if (mv === 'call' && n.eq != null && tp.call > 0 && n.eq + 3 < Math.round(tp.odds * 100) && !(adv.sure === 'close'))
    audit('call-underpriced', 'advises calling: wins about ' + n.eq + '%, but needs ' + Math.round(tp.odds * 100) + '% at the true price', H);
}
function checkChoice(g, me, sp, adv, rec, audit, H){
  const j = rec && rec.judgement, ch = rec && rec.choice;
  if (!j || !ch) return;
  H.decisions.push({ street:sp.street, action:ch.action, tag:j.tag, verdict:j.verdict, conf:j.confidence, advice: adv ? adv.move : null, spot:H.last });
  // A7 a call with your last chips is a call, not a shove or a raise
  const couldOnlyCall = sp.toCall > 0 && sp.stack <= sp.toCall;
  if (couldOnlyCall && ch.action === 'allin' && /push|shove|raise/.test(j.tag))
    audit('allin-call', 'you called with your last chips; he judged it as "' + j.tag + '"', H);
  // A8 doing what he advised is never a mistake (the advice and the verdict agree)
  const did = ch.action === 'allin' ? (couldOnlyCall ? 'call' : 'allin') : ch.action;
  const said = adv ? (adv.move === 'bet' ? 'raise' : adv.move) : null;
  const same = said && (did === said || (said === 'raise' && did === 'allin') || (said === 'allin' && did === 'raise') || (said === 'check' && did === 'call' && sp.toCall === 0));
  if (same && j.verdict === 'mistake') audit('advice-vs-verdict', 'advised ' + adv.move + ', you did, and he called it a mistake (' + j.tag + ')', H);
  // A8b a shove judged from a seat that nobody acts after says "players after you"
  if (/short\.push\.loose/.test(j.tag) && sp.actingAfter === 0) audit('nobody-after', 'judged "' + j.tag + '" (too many players after you) with nobody after you', H);
}
function checkEnd(g, players, h, net, startChips, audit, H){
  if (!h) return;
  // A9 "you could have won more" when you won everything the others had
  const me = players[0];
  const rivals = players.filter(p => p !== me && p.inHand && !p.folded);
  const tookAll = net > 0 && rivals.length && rivals.every(p => p.chips === 0);
  const missed = (h.decisions || []).some(d => d.judgement && d.judgement.tag === 'bet.missed');
  if (tookAll && missed) H.flags = (H.flags || []).concat('wonAllButMissed');
  if (tookAll && missed && !(h.end && h.end.tookAll)) audit('won-more', 'would say "you could have won more" after winning everything they had', H);
}

async function run(games, seed, opts){
  opts = Object.assign({ follow:0.6, maxHands:250, verbose:false }, opts || {});
  API = load(seed);
  const R = seeded(seed * 7 + 1);
  const found = {};
  const log = { games:0, hands:0, decisions:0, heroOut:0 };
  const audit = (kind, msg, H) => {
    const f = found[kind] || (found[kind] = { count:0, examples:[] });
    f.count++;
    if (f.examples.length < 4) f.examples.push({ msg, hand:H.n, bb:H.bb, spot:H.last, decisions:H.decisions.slice() });
  };
  const origSpot = API.CoachBrain.spot;
  for (let i = 0; i < games; i++){
    const o = Object.assign({}, opts, {
      opponents: 1 + Math.floor(R() * 5),
      stack: [500, 500, 600, 1000, 1500][Math.floor(R() * 5)],
      difficulty: ['medium', 'hard', 'expert'][Math.floor(R() * 3)]
    });
    await playGame(o, R, (k, m, H) => audit(k, m, H), log);
  }
  return { log, found };
}

module.exports = { run, truePrice };

if (require.main === module){
  const games = +process.argv[2] || 20, seed = +process.argv[3] || 1;
  run(games, seed).then(({ log, found }) => {
    console.log('games ' + log.games + ', hands ' + log.hands + ', you knocked out in ' + log.heroOut);
    const kinds = Object.keys(found);
    if (!kinds.length) console.log('No disagreements.');
    kinds.sort((a, b) => found[b].count - found[a].count).forEach(k => {
      console.log('\n== ' + k + ': ' + found[k].count);
      found[k].examples.forEach(e => console.log('  - ' + e.msg + '\n    hand ' + e.hand + ' (bb ' + e.bb + ') ' + JSON.stringify(e.spot) +
        (e.decisions.length ? '\n    decisions: ' + e.decisions.map(d => d.street + ' ' + d.action + ' → ' + d.tag + ' ' + d.verdict + (d.advice ? ' (advised ' + d.advice + ')' : '')).join(' | ') : '')));
    });
  }).catch(e => { console.error(e); process.exit(1); });
}
