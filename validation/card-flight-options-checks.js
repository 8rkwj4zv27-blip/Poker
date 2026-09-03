#!/usr/bin/env node
"use strict";

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'card-flight-options.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/card-flight-options.css'),'utf8');
const source=fs.readFileSync(path.join(root,'js/card-flight-options.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const serviceWorker=fs.readFileSync(path.join(root,'sw.js'),'utf8');

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }

check('The paused housing exploration leaves only the 52-card pile',()=>{
  assert.ok(html.includes('id="cfo-deck"'));
  assert.ok(!html.includes('data-housing='));
  assert.ok(!html.includes('cfo-housing'));
  assert.ok(!html.includes('cfo-deck-count'));
  assert.ok(!html.includes('cfo-dealer-label'));
  assert.ok(!css.includes('[data-housing='));
  assert.ok(css.includes('box-shadow:none!important; filter:none!important'));
  assert.ok(html.includes('data-direction="deal"'));
  assert.ok(html.includes('data-direction="return"'));
});

check('Chosen Option A motion is locked for deal and return',()=>{
  assert.ok(source.includes("deal:{name:'Dealer flick'"));
  assert.ok(source.includes("return:{name:'House sweep'"));
  assert.ok(!source.includes('Casino pitch'));
  assert.ok(!source.includes('Showboat sling'));
  assert.ok(!html.includes('data-variant='));
});

check('Every option shares destination-anchored centre geometry',()=>{
  assert.ok(source.includes("shell.style.left=destinationRect.left+'px'"));
  assert.ok(source.includes("shell.style.top=destinationRect.top+'px'"));
  assert.ok(source.includes("shell.style.width=destinationRect.width+'px'"));
  assert.ok(source.includes("shell.style.height=destinationRect.height+'px'"));
  assert.ok(source.includes('x-destinationX'));
  assert.ok(source.includes('y-destinationY'));
  assert.ok(source.includes("[1,1,0,0,0,1,null,0]"));
  assert.ok(source.includes('normalX*curve'));
  assert.ok(source.includes('normalY*curve-lift'));
});

check('The flight is the visible top deck card, not a spawned generic sprite',()=>{
  assert.ok(source.includes("const source=returning?targetCard:availableDeckTop()"));
  assert.ok(source.includes('const card=source.cloneNode(false)'));
  assert.ok(source.includes("source.style.visibility='hidden'"));
  assert.ok(source.includes("card.className='card back small'"));
  assert.ok(source.includes('for (let index=0;index<10;index++)'));
});

check('One-card and five-card playback remain available without comparison chrome',()=>{
  assert.ok(html.includes('id="cfo-replay"'));
  assert.ok(html.includes('id="cfo-sequence"'));
  assert.ok(!html.includes('id="cfo-compare"'));
  assert.ok(source.includes('async function playOne()'));
  assert.ok(source.includes('async function playFive()'));
});

check('Return mode starts with dealt cards and rebuilds the deck layer by layer',()=>{
  assert.ok(source.includes("Array.from(deck.children).slice(-5)"));
  assert.ok(source.includes("targets.forEach(card=>{ card.style.opacity='1'; })"));
  assert.ok(source.includes("const destination=returning?nextEmptyDeckLayer():targetCard"));
  assert.ok(source.includes("if (returning) destination.style.visibility='visible'"));
  assert.ok(source.includes("direction==='return'?targets.slice().reverse():targets"));
});

check('Slow inspection changes duration without changing the authored path',()=>{
  assert.ok(html.includes('data-speed="slow"'));
  assert.ok(source.includes("choice.duration*(playback==='slow'?2.5:1)"));
});

check('The instrument measures refresh, transform diversity, gaps and landing drift',()=>{
  assert.ok(source.includes('refreshMs=median'));
  assert.ok(source.includes('const transforms=new Set()'));
  assert.ok(source.includes('observed*1.75'));
  assert.ok(source.includes("' significant gaps · landing drift '"));
});

check('Replay and reset cancel every owned animation and flight node',()=>{
  assert.ok(source.includes('const active=new Set()'));
  assert.ok(source.includes('run.animation.cancel()'));
  assert.ok(source.includes('run.shadowAnimation.cancel()'));
  assert.ok(source.includes('run.shell.remove()'));
  assert.ok(source.includes('active.clear()'));
});

check('The prototype is isolated from production and persistence',()=>{
  assert.ok(!html.includes('js/05-game-engine.js'));
  assert.ok(!html.includes('js/06-presentation.js'));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('Store.'));
  assert.ok(!index.includes('card-flight-options'));
  assert.ok(!serviceWorker.includes('card-flight-options'));
});

check('Continuous flight styling avoids stepped animation and layout animation',()=>{
  assert.ok(!css.includes('steps('));
  assert.ok(!source.includes('setInterval'));
  assert.ok(source.includes("shell.animate(frames,{duration,easing:'linear',fill:'both'})"));
  assert.ok(css.includes('will-change:transform'));
});

process.stdout.write('\n'+passed+' focused Card Flight Options checks passed.\n');
