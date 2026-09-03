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

check('The workshop exposes four restrained deck treatments',()=>{
  for (const housing of ['naked','line','pad','stack']){
    assert.ok(html.includes('data-housing="'+housing+'"'));
    assert.ok(source.includes(housing+':{'));
    assert.ok(css.includes('[data-housing="'+housing+'"]'));
  }
  for (const name of ['The naked deck','The dealer line','The slim deck pad','The shadow stack']) assert.ok(source.includes(name));
  assert.ok(html.includes('data-direction="deal"'));
  assert.ok(html.includes('data-direction="return"'));
});

check('Chosen Option A motion is locked for deal and return',()=>{
  assert.ok(source.includes("const variant='dealer'"));
  assert.ok(source.includes("dealer:{label:'Dealer flick'"));
  assert.ok(source.includes("dealer:{label:'House sweep'"));
  assert.ok(!html.includes('data-variant='));
});

check('Deck label, top card and count are authored on one centre axis',()=>{
  assert.ok(css.includes('width:64px; height:91px'));
  assert.ok(css.includes('left:50%; top:-14px; transform:translateX(-50%)'));
  assert.ok(css.includes('z-index:2; left:8px; top:7px; width:43px'));
  assert.ok(css.includes('left:50%; bottom:0; min-width:24px'));
  assert.ok(css.includes('left:7px; top:2px; width:50px'));
  assert.ok(css.includes('left:3px; top:65px; width:58px'));
  assert.ok(css.includes('left:14px; top:11px; width:36px'));
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

check('One-card, five-card and four-treatment comparison playback are all available',()=>{
  assert.ok(html.includes('id="cfo-replay"'));
  assert.ok(html.includes('id="cfo-sequence"'));
  assert.ok(html.includes('id="cfo-compare"'));
  assert.ok(source.includes('async function playOne()'));
  assert.ok(source.includes('async function playFive()'));
  assert.ok(source.includes('for (const name of Object.keys(HOUSINGS))'));
});

check('Casino and wild treatments choose a fresh signed spin per card',()=>{
  assert.ok((source.match(/spinChoices:\[180,360\]/g)||[]).length===2);
  assert.ok((source.match(/spinChoices:\[360,540,720\]/g)||[]).length===2);
  assert.ok(source.includes('Math.floor(Math.random()*choice.spinChoices.length)'));
  assert.ok(source.includes("Math.random()<.5?-1:1"));
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
