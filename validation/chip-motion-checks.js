#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const production=fs.readFileSync(path.join(root,'js/06-presentation.js'),'utf8');
const lab=fs.readFileSync(path.join(root,'js/showdown-rail-lab.js'),'utf8');
const labHtml=fs.readFileSync(path.join(root,'showdown-rail-lab.html'),'utf8');
const entry=fs.readFileSync(path.join(root,'chip-motion-lab.html'),'utf8');
const support=fs.readFileSync(path.join(root,'js/02-support-systems.js'),'utf8');
const serviceWorker=fs.readFileSync(path.join(root,'sw.js'),'utf8');

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }
function slice(from,to){ return production.slice(production.indexOf(from),production.indexOf(to)); }

check('Ordinary chips use one uninterrupted compositor timeline',()=>{
  const flight=slice('function flyChip(opts){','function chipStaggerGap(n, fast){');
  assert.strictEqual((flight.match(/\.animate\(/g)||[]).length,1);
  assert.ok(flight.includes("willChange = 'transform'"));
  assert.ok(flight.includes('animation.finished.then(finish'));
  assert.ok(flight.includes("offset:.18"));
  assert.ok(flight.includes("offset:.82"));
  assert.ok(flight.includes("offset:1"));
  assert.ok(!flight.includes("style.transition = 'transform"));
  assert.ok(!flight.includes('setTimeout'));
});

check('Flights own cancellation and preserve exact landing bookkeeping',()=>{
  const flight=slice('const activeChipFlights=new Set();','function chipStaggerGap(n, fast){');
  assert.ok(flight.includes('activeChipFlights.add(owner)'));
  assert.ok(flight.includes('activeChipFlights.delete(owner)'));
  assert.ok(flight.includes('const owner={cancel:finish}'));
  assert.ok(flight.includes('settleSlot(dstContainer, placeholder, el)'));
  assert.ok(flight.includes("motionOff() || !a.width"));
  const clear=slice('function clearAllCardDOM(){','async function muckCards');
  assert.ok(clear.includes('cancelAllChipFlights()'));
});

check('Large transfers retain their bounded self-correcting lane',()=>{
  const transfer=slice('const MAX_CONCURRENT_FLIGHTS = 6;','function payoutTo(winner, n){');
  assert.ok(transfer.includes('active>=MAX_CONCURRENT_FLIGHTS'));
  assert.ok(transfer.includes('gateOpen = false'));
  assert.ok(transfer.includes('onLand: ()=>{ active--; landed++'));
  assert.ok(transfer.includes('chipStaggerGapAt(n, launched, fast)'));
});

check('Pot-smash frames mutate transform only',()=>{
  const apply=slice('function applyChipTransform(c){','function pickLaunchClass(){');
  assert.ok(apply.includes('translate3d('));
  assert.ok(apply.includes('c.x-c.originX'));
  assert.ok(apply.includes('c.y-z-c.originY'));
  assert.ok(!apply.includes('.style.left'));
  assert.ok(!apply.includes('.style.top'));
  const spawn=slice('function spawnPhysicsChip','function maybePlayBounceSound');
  assert.ok(spawn.includes("willChange = 'transform'"));
  assert.ok(spawn.includes('originX:cx'));
  assert.ok(spawn.includes('originY:cy'));
  assert.ok(!spawn.includes("left,top,transform"));
});

check('Maximum smash batches source geometry before removing chips',()=>{
  const take=slice('function takeChipFromPile(container, pile, measuredRects){','function createRestingChip');
  const smash=slice('async function runPotBreakPhysics','/* Top-level pot-smash orchestrator');
  assert.ok(take.includes('(measuredRects && measuredRects.get(el))'));
  assert.ok(smash.includes('const restingRects = new Map()'));
  assert.ok(smash.indexOf("querySelectorAll('.chip-disc')")<smash.indexOf('for (let i=0;i<potN;i++)'));
  assert.ok(smash.includes('takeChipFromPile(potContainer, pPile, restingRects)'));
});

check('The production-native fixture covers every approved direction and load',()=>{
  ['bank-pot','opponent-pot','pot-opponent','smash-bank'].forEach(kind=>assert.ok(lab.includes(kind)));
  ['value="2"','value="6"','value="18"','value="60"'].forEach(value=>assert.ok(labHtml.includes(value)));
  assert.ok(lab.includes('transferChips(count'));
  assert.ok(lab.includes('payoutTo(opponent,count)'));
  assert.ok(lab.includes('runPotSmashSequence'));
  assert.ok(lab.includes('averageMs'));
  assert.ok(lab.includes('over34'));
  assert.ok(lab.includes('storageUnchanged'));
  assert.ok(entry.includes('chip-motion=1&source=embedded'));
});

check('Fixture remains outside the offline game shell',()=>{
  assert.ok(!serviceWorker.includes("'./chip-motion-lab.html'"));
  assert.ok(!serviceWorker.includes("'./showdown-rail-lab.html'"));
});

check('Build and offline cache markers identify this checkpoint',()=>{
  assert.ok(support.includes("const BUILD_VERSION = 'v0.32.7-dev · Chip Motion'"));
  assert.ok(serviceWorker.includes("const CACHE_NAME = 'poker-v32-7'"));
});

process.stdout.write('\n'+passed+' focused Chip Motion checks passed.\n');
