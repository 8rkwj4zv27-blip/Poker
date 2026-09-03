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

check('The comparison exposes all three distinct flight treatments',()=>{
  for (const variant of ['dealer','casino','machine']){
    assert.ok(html.includes('data-variant="'+variant+'"'));
    assert.ok(source.includes(variant+':{'));
  }
  assert.ok(html.includes('Dealer flick'));
  assert.ok(html.includes('Casino pitch'));
  assert.ok(html.includes('Machine feed'));
});

check('Every option shares destination-anchored centre geometry',()=>{
  assert.ok(source.includes("shell.style.left=destinationRect.left+'px'"));
  assert.ok(source.includes("shell.style.top=destinationRect.top+'px'"));
  assert.ok(source.includes("shell.style.width=destinationRect.width+'px'"));
  assert.ok(source.includes("shell.style.height=destinationRect.height+'px'"));
  assert.ok(source.includes('x-destinationX'));
  assert.ok(source.includes('y-destinationY'));
  assert.ok(source.includes("[1,1,0,0,0,1,null]"));
});

check('The flight is the visible top deck card, not a spawned generic sprite',()=>{
  assert.ok(source.includes('const source=availableDeckTop()'));
  assert.ok(source.includes('const card=source.cloneNode(false)'));
  assert.ok(source.includes("source.style.visibility='hidden'"));
  assert.ok(source.includes("card.className='card back small'"));
  assert.ok(source.includes('for (let index=0;index<10;index++)'));
});

check('One-card, five-card and sequential comparison playback are all available',()=>{
  assert.ok(html.includes('id="cfo-replay"'));
  assert.ok(html.includes('id="cfo-sequence"'));
  assert.ok(html.includes('id="cfo-compare"'));
  assert.ok(source.includes('async function dealOne()'));
  assert.ok(source.includes('async function dealFive()'));
  assert.ok(source.includes("for (const name of ['dealer','casino','machine'])"));
});

check('Slow inspection changes duration without changing the authored path',()=>{
  assert.ok(html.includes('data-speed="slow"'));
  assert.ok(source.includes("treatment.duration*(playback==='slow'?2.5:1)"));
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
