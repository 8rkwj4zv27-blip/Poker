#!/usr/bin/env node
"use strict";

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const production=fs.readFileSync(path.join(root,'js/06-presentation.js'),'utf8');
const wiring=fs.readFileSync(path.join(root,'js/07-ui-wiring.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/02-screens.css'),'utf8');
const support=fs.readFileSync(path.join(root,'js/02-support-systems.js'),'utf8');
const serviceWorker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const lab=fs.readFileSync(path.join(root,'js/card-turn-lab.js'),'utf8');
const labHtml=fs.readFileSync(path.join(root,'card-turn-lab.html'),'utf8');

let passed=0;
function check(name,fn){
  return Promise.resolve().then(fn).then(()=>{ passed++; process.stdout.write('PASS  '+name+'\n'); });
}

class FakeAnimation{
  constructor(keyframes,options){
    this.keyframes=keyframes; this.options=options; this.cancelled=false;
    this.finished=new Promise((resolve,reject)=>{ this.resolve=resolve; this.reject=reject; });
  }
  finish(){ this.resolve(); }
  cancel(){ this.cancelled=true; this.reject(new Error('cancelled')); }
}

class FakeElement{
  constructor(rect={left:0,top:0,width:44,height:62}){
    this.rect=rect; this.style={willChange:''}; this.children=[]; this.parentNode=null;
    this.isConnected=false; this.animations=[]; this.className=''; this.attributes={};
  }
  getBoundingClientRect(){ return this.rect; }
  setAttribute(name,value){ this.attributes[name]=String(value); }
  appendChild(child){
    child.parentNode=this; child.isConnected=true; this.children.push(child); return child;
  }
  remove(){
    if (this.parentNode) this.parentNode.children=this.parentNode.children.filter(child=>child!==this);
    this.parentNode=null; this.isConnected=false;
  }
  animate(keyframes,options){
    const animation=new FakeAnimation(keyframes,options); this.animations.push(animation); return animation;
  }
}

const body=new FakeElement(); body.isConnected=true;
const felt=new FakeElement({left:8,top:20,width:374,height:500}); felt.isConnected=true;
felt.clientLeft=2; felt.clientTop=2;
const context={
  Promise,Set,Array,Object,Math,
  reduced:false,speed:1,
  motionOff(){ return context.reduced; },
  speedMult(){ return context.speed; },
  $(id){ return id==='felt'?felt:null; },
  document:{body,createElement(){ return new FakeElement(); }}
};
const flightSource=production.slice(production.indexOf('const DEAL_TIMING'),production.indexOf('/* One dealt card'));
vm.createContext(context);
vm.runInContext(flightSource+'\nthis.api={DealFX,DEAL_TIMING};',context);
const api=context.api;

function endpoints(style='deal'){
  const from=new FakeElement({left:40,top:390,width:44,height:62});
  const to=new FakeElement({left:246,top:112,width:55,height:78});
  from.className=style==='return'?'card back':'card back small';
  to.className=style==='return'?'card back small':'card back';
  return {from,to};
}

(async()=>{
  await check('Dealer Flick uses the approved continuous seven-waypoint arc',async()=>{
    const {from,to}=endpoints();
    const promise=api.DealFX.flyGhost(from,to,{duration:api.DEAL_TIMING.dealMs,style:'deal'});
    assert.strictEqual(body.children.length,1);
    const ghost=body.children[0];
    assert.strictEqual(ghost.className,'card back small fly-card');
    assert.strictEqual(ghost.animations.length,1);
    const animation=ghost.animations[0];
    assert.strictEqual(animation.options.duration,560);
    assert.deepStrictEqual(Array.from(animation.keyframes,frame=>frame.offset),[0,.10,.24,.68,.90,.96,1]);
    assert.ok(animation.keyframes.every(frame=>frame.transform.startsWith('perspective(800px) translate3d(')));
    assert.ok(animation.keyframes.every(frame=>!Object.hasOwn(frame,'left')&&!Object.hasOwn(frame,'top')));
    assert.strictEqual(ghost.style.left,'246px');
    assert.strictEqual(ghost.style.top,'112px');
    assert.strictEqual(ghost.style.width,'55px');
    assert.strictEqual(ghost.style.height,'78px');
    assert.strictEqual(from.style.visibility,'hidden');
    assert.strictEqual(animation.keyframes.at(-1).transform,'perspective(800px) translate3d(0px,0px,0px) rotateZ(0deg) rotateX(0deg) scale(1,1)');
    assert.strictEqual(ghost.style.willChange,'transform');
    animation.finish();
    assert.strictEqual(await promise,true);
    assert.strictEqual(body.children.length,0);
    assert.strictEqual(ghost.style.willChange,'');
    assert.strictEqual(from.style.visibility,'');
    assert.strictEqual(api.DealFX.activeCount(),0);
  });

  await check('House Sweep stays solid and becomes the real deck-top card on contact',async()=>{
    const {from,to}=endpoints('return');
    const promise=api.DealFX.flyGhost(from,to,{duration:api.DEAL_TIMING.collectMs,style:'return'});
    assert.strictEqual(felt.children.length,1);
    const ghost=felt.children[0];
    assert.strictEqual(ghost.className,'card back small fly-card return');
    assert.strictEqual(ghost.style.left,'236px');
    assert.strictEqual(ghost.style.top,'90px');
    const animation=ghost.animations[0];
    assert.strictEqual(animation.options.duration,610);
    assert.deepStrictEqual(Array.from(animation.keyframes,frame=>frame.offset),[0,.10,.26,.70,.91,.97,1]);
    assert.ok(animation.keyframes.every(frame=>!Object.hasOwn(frame,'opacity')));
    assert.ok(animation.keyframes.every(frame=>Math.abs(Number(frame.transform.match(/rotateZ\((-?[\d.]+)deg\)/)[1]))<=12));
    assert.strictEqual(animation.keyframes.at(-1).transform,'perspective(800px) translate3d(0px,0px,0px) rotateZ(0deg) rotateX(0deg) scale(1,1)');
    assert.strictEqual(ghost.style.willChange,'transform');
    animation.finish();
    assert.strictEqual(await promise,true);
    assert.strictEqual(felt.children.length,0);
  });

  await check('Cancellation settles false and removes every animation owner',async()=>{
    const firstEndpoints=endpoints(), secondEndpoints=endpoints('return');
    const first=api.DealFX.flyGhost(firstEndpoints.from,firstEndpoints.to,{style:'deal'});
    const second=api.DealFX.flyGhost(secondEndpoints.from,secondEndpoints.to,{style:'return'});
    const animations=[body.children[0].animations[0],felt.children[0].animations[0]];
    assert.strictEqual(api.DealFX.activeCount(),2);
    api.DealFX.cancelAll();
    assert.deepStrictEqual(await Promise.all([first,second]),[false,false]);
    assert.ok(animations.every(animation=>animation.cancelled));
    assert.strictEqual(body.children.length,0);
    assert.strictEqual(felt.children.length,0);
    assert.strictEqual(firstEndpoints.from.style.visibility,'');
    assert.strictEqual(api.DealFX.activeCount(),0);
  });

  await check('Repeated flights leave no ghosts, callbacks or active records behind',async()=>{
    for (let index=0;index<20;index++){
      const {from,to}=endpoints(index%2?'return':'deal');
      const promise=api.DealFX.flyGhost(from,to,{style:index%2?'return':'deal'});
      const container=index%2?felt:body;
      container.children[0].animations[0].finish();
      assert.strictEqual(await promise,true);
    }
    assert.strictEqual(body.children.length+felt.children.length,0);
    assert.strictEqual(api.DealFX.activeCount(),0);
  });

  await check('Reduced motion creates no ghost or animation object',async()=>{
    context.reduced=true;
    const {from,to}=endpoints();
    assert.strictEqual(await api.DealFX.flyGhost(from,to,{style:'deal'}),true);
    assert.strictEqual(body.children.length+felt.children.length,0);
    context.reduced=false;
  });

  await check('Flight production has no chained transition or timer driver',()=>{
    assert.ok(!flightSource.includes('setTimeout'));
    assert.ok(!flightSource.includes('style.transition'));
    assert.ok(!flightSource.includes('offsetWidth'));
    assert.strictEqual((flightSource.match(/\.animate\(/g)||[]).length,1);
    assert.ok(!/\.fly-card\s*\{[^}]*will-change/s.test(css));
    assert.ok(css.includes('.fly-card.return{ position:absolute; z-index:6; }'));
    assert.ok(!flightSource.includes('opacity:0'));
    assert.ok(!flightSource.includes('720'));
  });

  await check('Chosen flight and card-turn timings are locked',()=>{
    assert.deepStrictEqual(JSON.parse(JSON.stringify(api.DEAL_TIMING)),{
      dealMs:560,dealStaggerMs:420,flopStaggerMs:420,settleBeforeFlipMs:90,collectMs:610,collectStaggerMaxMs:140
    });
    assert.ok(production.includes('const CARD_TURN_TIMING = Object.freeze({ hole:600, board:700, showdown:800 });'));
  });

  await check('The production dealer station is only a full bare card pile',()=>{
    const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
    assert.strictEqual((index.match(/class="card back small" style="--deck-layer:/g)||[]).length,10);
    assert.ok(!index.includes('dealer-label'));
    assert.ok(css.includes('.dealer-deck .card.back{ box-shadow:none; }'));
    assert.ok(css.includes('background:transparent; box-shadow:none;'));
  });

  await check('Hand resets and table navigation cancel shared flight ownership',()=>{
    assert.ok(production.includes('function clearAllCardDOM(){\n  DealFX.cancelAll();'));
    assert.ok(wiring.includes('function doLeaveTable(){\n  clearTimeout(autoDealT);\n  DealFX.cancelAll();'));
    assert.ok(production.includes('if (!landed || !el.isConnected) return;'));
    assert.ok(production.includes("if (!completed) el.style.opacity='';"));
  });

  await check('The development instrument exposes production deal and return flights',()=>{
    assert.ok(labHtml.includes('js/06-presentation.js'));
    assert.ok(lab.includes('DealFX.flyGhost'));
    assert.ok(lab.includes('activeFlights:DealFX.activeCount()'));
    assert.ok(lab.includes("document.querySelector('.fly-card')"));
  });

  await check('Build and offline cache markers are synchronised for Card Flight',()=>{
    assert.ok(support.includes("const BUILD_VERSION = 'v0.32.7-dev · Chip Motion'"));
    assert.ok(serviceWorker.includes("const CACHE_NAME = 'poker-v32-7'"));
  });

  process.stdout.write('\n'+passed+' focused Card Flight checks passed.\n');
})().catch(error=>{ console.error(error); process.exitCode=1; });
