#!/usr/bin/env node
"use strict";

/* Checks for SAVE DATA (js/save-data.js): back up, restore, reset stats,
   start over. The real file runs in a VM with the real Store from
   js/02-support-systems.js over a fake localStorage; the few DOM and game
   helpers it touches are stubbed.
   Run: node validation/save-data-checks.js */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
function check(name, fn){ fn(); passed++; process.stdout.write('PASS  ' + name + '\n'); }

// just enough of an element for the plate to be built
function fakeEl(){
  const e = { className:'', innerHTML:'', dataset:{}, hidden:false, children:[], style:{},
    classList:{ toggle(){}, add(){}, remove(){} },
    appendChild(c){ this.children.push(c); return c; }, insertBefore(c){ this.children.push(c); return c; },
    addEventListener(){}, querySelector(){ return null; }, click(){}, remove(){} };
  return e;
}
const storage = {};
const localStorage = {
  getItem:k => (k in storage ? storage[k] : null),
  setItem:(k, v) => { storage[k] = String(v); },
  removeItem:k => { delete storage[k]; }
};
const ctx = {
  console, Math, JSON, Number, String, Array, Object, Date, Blob:function(){}, URL:{},
  btoa:s => Buffer.from(s, 'binary').toString('base64'),
  atob:s => Buffer.from(s, 'base64').toString('binary'),
  escape, unescape, encodeURIComponent, decodeURIComponent, isNaN,
  navigator:{}, location:{ reload(){} }, requestAnimationFrame(){},
  document:{ createElement:fakeEl, querySelector:() => null, getElementById:() => null, body:fakeEl() },
  BUILD_VERSION:'test', CAREER_START_BANKROLL:500,
  settings:{}, saveSettings(){}, showConfirmDialog(){}, openOverlay(){}
};
ctx.window = { localStorage };
vm.createContext(ctx);
const support = read('js/02-support-systems.js');
const i = support.indexOf('const Store = (function(){'), j = support.indexOf('\n})();', i);
vm.runInContext(support.slice(i, j + 6) + ';globalThis.Store = Store;', ctx);
vm.runInContext(read('js/save-data.js') + ';globalThis.SaveData = SaveData;', ctx);
const { Store, SaveData } = ctx;
const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

// a phone with a bit of everything on it
function fill(){
  Object.keys(storage).forEach(k => delete storage[k]);
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('felt.settings', { sound:true, playerName:'Thom ♠', theme:'emerald' });
  put('felt.stats', { hands:312, won:120, showdownsWon:40, biggestPot:2200, net:900 });
  put('felt.table', { handNumber:7, players:[] });
  put('felt.career', { v:1, bankroll:4200, eventsPlayed:3, eventsWon:1, rosters:{} });
  put('felt.career.table', { eventId:'x' });
  put('felt.arcade', { highScore:9000, discovered:{ a:true }, counts:{ a:2 }, bestByEvent:{} });
  put('felt.finishes', { press:'soft' });
  put('felt.gameplay.metrics.v1', { v:1, formats:{} });
  put('pip.coach', { terms:{ pot:1 } });
  localStorage.setItem('someone.else', 'untouched');
}
const has = k => k in storage;
const dump = () => JSON.stringify(Object.keys(storage).sort().map(k => [k, storage[k]]));

check('the backup covers every key the game saves (QUICKMAP "Saved data")', () => {
  const m = /## Saved data[^\n]*\n\n([\s\S]*?)(?:\n\n|\n?$)/.exec(read('docs/QUICKMAP.md'));
  const listed = m[1].match(/`([^`]+)`/g).map(s => s.slice(1, -1)).sort();
  same([...SaveData.KEYS].sort(), listed);
});

check('every storage key in the live code is in the backup', () => {
  const html = read('index.html');
  const files = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map(m => m[1]);
  const keys = new Set();
  files.forEach(f => {
    const src = read(f);
    for (const m of src.matchAll(/Store\.(?:get|set|remove)\('([^']+)'/g)) keys.add(m[1]);
    for (const m of src.matchAll(/_KEY\s*=\s*'([^']+)'/g)) keys.add(m[1]);
  });
  keys.forEach(k => assert(SaveData.KEYS.includes(k), k + ' is saved by the game but missing from the backup'));
});

check('a backup restores exactly what was there', () => {
  fill();
  const before = dump();
  const save = SaveData.snapshot();
  same(Object.keys(save.data).sort(), [...SaveData.KEYS].sort());
  Object.keys(storage).forEach(k => { if (k !== 'someone.else') delete storage[k]; });
  SaveData.write(SaveData.parse(JSON.stringify(save)));
  assert.strictEqual(dump(), before);
});

check('a save code round-trips too, names with symbols included', () => {
  fill();
  const save = SaveData.snapshot();
  const back = SaveData.parse(SaveData.toCode(save));
  same(back, save);
  assert.strictEqual(back.data['felt.settings'].playerName, 'Thom ♠');
});

check('a restore clears what the save does not have', () => {
  fill();
  const save = SaveData.snapshot();
  delete save.data['felt.table'];
  fill();
  SaveData.write(SaveData.parse(JSON.stringify(save)));
  assert(!has('felt.table'));
  assert(has('felt.career'));
  assert.strictEqual(storage['someone.else'], 'untouched');
});

check('anything that is not a good save is turned away', () => {
  fill();
  const good = SaveData.snapshot();
  const bad = [
    '', 'hello', '{}', '[]', 'PF1:!!!', JSON.stringify({ ...good, format:'other' }),
    JSON.stringify({ ...good, v:2 }), JSON.stringify({ ...good, data:[] }),
    JSON.stringify({ ...good, data:{ ...good.data, 'evil.key':1 } }),
    JSON.stringify({ ...good, data:{ ...good.data, 'felt.career':{ bankroll:'lots' } } }),
    JSON.stringify({ ...good, data:{ ...good.data, 'felt.settings':'x' } })
  ];
  bad.forEach(t => assert.strictEqual(SaveData.parse(t), null, 'accepted: ' + t.slice(0, 60)));
  assert(SaveData.parse('  ' + JSON.stringify(good) + '\n'));
});

check('Reset stats clears stats, awards and pacing only', () => {
  fill();
  SaveData.clear(SaveData.STATS_KEYS);
  ['felt.stats', 'felt.arcade', 'felt.gameplay.metrics.v1'].forEach(k => assert(!has(k), k));
  ['felt.settings', 'felt.career', 'felt.career.table', 'felt.table', 'felt.finishes', 'pip.coach'].forEach(k => assert(has(k), k));
});

check('Start over keeps settings and Workshop picks, nothing else', () => {
  fill();
  SaveData.clear(SaveData.START_OVER_KEYS);
  same(Object.keys(storage).sort(), ['felt.finishes', 'felt.settings', 'someone.else']);
});

check('a frozen Store writes nothing (the reload after a restore or reset)', () => {
  fill();
  Store.freeze();
  Store.set('felt.stats', { hands:1 });
  Store.remove('felt.career');
  assert.strictEqual(JSON.parse(storage['felt.stats']).hands, 312);
  assert(has('felt.career'));
});

process.stdout.write('\n' + passed + ' save data checks passed.\n');
