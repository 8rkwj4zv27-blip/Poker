#!/usr/bin/env node
"use strict";
/* The new Career's money, simulated (docs/career/INVITATIONS_PLAN.md).

   Every invitation event is played to its end by event-sim.js (the game's
   own AI, "you" at a few skills); then:
   - what each event pays on average, and how often it pays at all
   - what each packet is worth: its cards' average prizes, drawn the way
     the game draws them (CAREER_PACKETS: a rarity per slot, an event
     evenly among that rarity's)
   - whole Careers: $500 and the starter packet, every card played, a
     House Packet bought whenever the bankroll allows, the pity packet at
     rock bottom; the bankroll after so many events

   Read-only: it prints numbers, it changes nothing. Not part of npm test.

     node validation/tools/invitation-economy.js [--you 20,40,70] [--events 300] [--careers 2000] [--json]
*/
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback; };
const YOU = arg('you', '20,40,70');
const EVENTS = Number(arg('events', 300));
const CAREERS = Number(arg('careers', 2000));
const STOPS = [10, 25, 50, 100];

function loadCatalogue(){
  const src = fs.readFileSync(path.join(ROOT, 'js/04-modes-and-scoring.js'), 'utf8');
  const body = src.slice(src.indexOf('const BLIND_LEVELS'), src.indexOf('function careerRosterSeats'));
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(body + '\nglobalThis.OUT = { CAREER_INVITATION_EVENTS, CAREER_PACKETS, CAREER_START_BANKROLL };', ctx);
  return ctx.OUT;
}

// a repeatable random stream
function seeded(seed){
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const { CAREER_INVITATION_EVENTS:INV, CAREER_PACKETS:PACKETS, CAREER_START_BANKROLL:START } = loadCatalogue();
const skills = YOU.split(',').map(s => 'skill ' + s);
const byRarity = r => INV.filter(e => e.rarity === r);

// 1. every event, played out
process.stderr.write('Playing ' + INV.length + ' events × ' + EVENTS + ' at skills ' + YOU + ' (slow: the real AI)…\n');
const played = {};
for (const ev of INV){
  process.stderr.write('  ' + ev.id + '\n');
  const out = execFileSync(process.execPath, [path.join(__dirname, 'event-sim.js'), ev.id, '--you', YOU, '--events', String(EVENTS), '--json'],
    { encoding:'utf8', maxBuffer:1 << 28 });
  played[ev.id] = JSON.parse(out).results;
}
const res = (id, k) => played[id][k];
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

// 2. a packet's worth: each slot's expected prize at this skill
function slotWorth(slot, k){
  const total = Object.values(slot).reduce((a, w) => a + w, 0);
  return Object.entries(slot).reduce((a, [r, w]) => a + w / total * mean(byRarity(r).map(e => res(e.id, k).netPerEvent)), 0);
}
function packetWorth(kind, k){
  const def = PACKETS[kind];
  return (def.fixed || []).reduce((a, id) => a + res(id, k).netPerEvent, 0) + def.slots.reduce((a, s) => a + slotWorth(s, k), 0);
}

// 3. whole Careers, card by card
function drawCards(kind, rnd){
  const def = PACKETS[kind], cards = [...(def.fixed || [])];
  for (const slot of def.slots){
    const total = Object.values(slot).reduce((a, w) => a + w, 0);
    let roll = rnd() * total, rarity = Object.keys(slot)[0];
    for (const [r, w] of Object.entries(slot)){ if ((roll -= w) < 0){ rarity = r; break; } }
    const pool = byRarity(rarity);
    cards.push(pool[Math.floor(rnd() * pool.length)].id);
  }
  return cards;
}
function career(k, rnd){
  let bank = START, cards = drawCards('starter', rnd), events = 0, hands = 0, bought = 0, pity = 0;
  const at = {};
  while (events < STOPS[STOPS.length - 1]){
    if (!cards.length){
      if (bank >= PACKETS.house.price){ bank -= PACKETS.house.price; bought++; cards = drawCards('house', rnd); }
      else { pity++; cards = drawCards('pity', rnd); }
    }
    const id = cards.shift(), r = res(id, k);
    bank += r.prizes[Math.floor(rnd() * r.prizes.length)];
    hands += r.hands;
    events++;
    if (STOPS.includes(events)) at[events] = { bank, bought, pity, hands };
  }
  return at;
}
const pctl = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

const report = { events:{}, packets:{}, careers:{} };
skills.forEach((name, k) => {
  INV.forEach(ev => { const r = res(ev.id, k); (report.events[ev.id] = report.events[ev.id] || {})[name] = { pays:Math.round(r.netPerEvent), cash:r.cash, win:r.win, hands:r.hands }; });
  report.packets[name] = Object.fromEntries(Object.keys(PACKETS).map(kind => [kind, Math.round(packetWorth(kind, k))]));
  const rnd = seeded(1000 + k), runs = Array.from({ length:CAREERS }, () => career(k, rnd));
  report.careers[name] = Object.fromEntries(STOPS.map(n => [n, {
    bankMedian:pctl(runs.map(r => r[n].bank), .5), bankLow:pctl(runs.map(r => r[n].bank), .1), bankHigh:pctl(runs.map(r => r[n].bank), .9),
    bought:mean(runs.map(r => r[n].bought)), pity:mean(runs.map(r => r[n].pity)), hands:Math.round(mean(runs.map(r => r[n].hands)))
  }]));
});

if (process.argv.includes('--json')){ console.log(JSON.stringify(report, null, 2)); return; }
const $ = n => '$' + Math.round(n).toLocaleString('en-US');
const pct = x => (Math.round(x * 100) + '%').padStart(4);
console.log('\nWHAT EACH EVENT PAYS (average prize; how often it pays)');
console.log('event'.padEnd(22) + 'rarity'.padEnd(11) + skills.map(s => s.padStart(18)).join(''));
INV.forEach(ev => console.log(ev.id.padEnd(22) + ev.rarity.padEnd(11) + skills.map(s => { const x = report.events[ev.id][s]; return ($(x.pays) + ' ' + pct(x.cash)).padStart(18); }).join('')));
console.log('\nWHAT A PACKET IS WORTH (its cards\' average prizes)');
console.log('packet'.padEnd(10) + 'price'.padStart(7) + skills.map(s => s.padStart(12)).join(''));
Object.keys(PACKETS).forEach(kind => console.log(kind.padEnd(10) + $(PACKETS[kind].price).padStart(7) + skills.map(s => $(report.packets[s][kind]).padStart(12)).join('')));
console.log('\nWHOLE CAREERS (' + CAREERS + ' each): bankroll after so many events, median (10th–90th percentile); House Packets bought; pity packets');
skills.forEach(s => {
  console.log(s);
  STOPS.forEach(n => { const c = report.careers[s][n]; console.log('  after ' + String(n).padStart(3) + ' events: ' + $(c.bankMedian).padStart(8) + '  (' + $(c.bankLow) + '–' + $(c.bankHigh) + ')  bought ' + c.bought.toFixed(1) + ', pity ' + c.pity.toFixed(1) + ', ' + c.hands + ' hands'); });
});
