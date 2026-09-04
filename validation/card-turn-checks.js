#!/usr/bin/env node
"use strict";

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const production=fs.readFileSync(path.join(root,'js/06-presentation.js'),'utf8');
const engine=fs.readFileSync(path.join(root,'js/05-game-engine.js'),'utf8');
const wiring=fs.readFileSync(path.join(root,'js/07-ui-wiring.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/02-screens.css'),'utf8');
const lab=fs.readFileSync(path.join(root,'js/card-turn-lab.js'),'utf8');
const labHtml=fs.readFileSync(path.join(root,'card-turn-lab.html'),'utf8');
const support=fs.readFileSync(path.join(root,'js/02-support-systems.js'),'utf8');
const serviceWorker=fs.readFileSync(path.join(root,'sw.js'),'utf8');

let passed=0;
function check(name,fn){
  return Promise.resolve().then(fn).then(()=>{ passed++; process.stdout.write('PASS  '+name+'\n'); });
}

class FakeClassList{
  constructor(owner){ this.owner=owner; this.values=[]; }
  set(value){ this.values=String(value||'').trim().split(/\s+/).filter(Boolean); }
  [Symbol.iterator](){ return this.values[Symbol.iterator](); }
  contains(value){ return this.values.includes(value); }
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
  constructor(){
    this.classList=new FakeClassList(this); this.children=[]; this.attributes={};
    this.style={willChange:''}; this.innerHTML=''; this.animations=[];
  }
  set className(value){ this._className=value; this.classList.set(value); }
  get className(){ return this._className||''; }
  setAttribute(name,value){ this.attributes[name]=String(value); }
  getAttribute(name){ return this.attributes[name]||null; }
  append(...children){ this.children.push(...children); }
  replaceChildren(...children){ this.children=children; this.innerHTML=''; }
  animate(keyframes,options){
    const animation=new FakeAnimation(keyframes,options); this.animations.push(animation); return animation;
  }
}

const turnSource=production.slice(production.indexOf('const CARD_TURN_TIMING'),production.indexOf('function syncCardRow'));
const context={
  Promise,Set,WeakMap,Array,Object,Math,
  reduced:false,speed:1,sounds:0,
  motionOff(){ return context.reduced; },
  speedMult(){ return context.speed; },
  Sound:{cardFlip(){ context.sounds++; }},
  document:{createElement(){ return new FakeElement(); }},
  cardClass(faceDown,card,small){ return 'card'+(small?' small':'')+(faceDown?' back':' heart'); },
  cardInner(card){ return '<b>'+card.rank+card.suit+'</b>'; },
  cardLabel(faceDown){ return faceDown?'Face-down card':'Ace of Hearts'; }
};
vm.createContext(context);
vm.runInContext(turnSource+'\nthis.api={turnCard,cancelAllCardTurns,setCardTurnFinal,CARD_TURN_TIMING,activeCardTurns};',context);
const api=context.api;
const card={rank:'A',suit:'♥',value:14};
function faceDownElement(){ const el=new FakeElement(); el.className='card back'; el.setAttribute('role','img'); el.setAttribute('aria-label','Face-down card'); return el; }

(async()=>{
  await check('A turn mounts two faces before one continuous master animation begins',async()=>{
    const el=faceDownElement();
    const promise=api.turnCard(el,false,card,false,'hole');
    assert.strictEqual(el.children.length,1);
    const flipper=el.children[0];
    assert.strictEqual(flipper.children.length,2);
    assert.strictEqual(flipper.animations.length,1);
    assert.strictEqual(flipper.style.willChange,'transform');
    assert.strictEqual(flipper.animations[0].keyframes.length,7);
    assert.ok(flipper.animations[0].keyframes.every(frame=>/rotateY/.test(frame.transform)));
    flipper.animations[0].finish();
    assert.strictEqual(await promise,true);
  });

  await check('Completion lands the exact face, accessibility label and clean registry state',async()=>{
    const el=faceDownElement();
    const promise=api.turnCard(el,false,card,false,'board');
    const animation=el.children[0].animations[0];
    assert.strictEqual(animation.options.duration,700);
    animation.finish();
    await promise;
    assert.strictEqual(el.className,'card heart');
    assert.strictEqual(el.getAttribute('aria-label'),'Ace of Hearts');
    assert.strictEqual(el.children.length,0);
    assert.strictEqual(api.activeCardTurns.size,0);
  });

  await check('Cancellation settles visibly and leaves no animation owner behind',async()=>{
    const el=faceDownElement();
    const promise=api.turnCard(el,false,card,false,'showdown');
    const animation=el.children[0].animations[0];
    api.cancelAllCardTurns();
    assert.strictEqual(await promise,false);
    assert.strictEqual(animation.cancelled,true);
    assert.strictEqual(el.className,'card heart');
    assert.strictEqual(api.activeCardTurns.size,0);
  });

  await check('A repeated invocation supersedes the old owner without ghosts or stale callbacks',async()=>{
    const el=faceDownElement();
    const first=api.turnCard(el,false,card,false,'hole');
    const second=api.turnCard(el,true,card,false,'hole');
    assert.strictEqual(await first,false);
    assert.strictEqual(api.activeCardTurns.size,1);
    const animation=el.children[0].animations[0];
    animation.finish();
    assert.strictEqual(await second,true);
    assert.strictEqual(el.className,'card back');
    assert.strictEqual(el.children.length,0);
    assert.strictEqual(api.activeCardTurns.size,0);
  });

  await check('Reduced motion resolves immediately with no mounted faces or animation object',async()=>{
    context.reduced=true;
    const el=faceDownElement();
    assert.strictEqual(await api.turnCard(el,false,card,false,'hole'),true);
    assert.strictEqual(el.className,'card heart');
    assert.strictEqual(el.children.length,0);
    assert.strictEqual(api.activeCardTurns.size,0);
    context.reduced=false;
  });

  await check('Normal and Fast speed scale the three production turn weights',async()=>{
    const cases=[['hole',1,600],['board',1,700],['showdown',1,800],['hole',.55,330],['board',.55,385],['showdown',.55,440]];
    for (const [kind,speed,duration] of cases){
      context.speed=speed;
      const el=faceDownElement();
      const promise=api.turnCard(el,false,card,false,kind);
      const animation=el.children[0].animations[0];
      assert.strictEqual(animation.options.duration,duration,kind+' at '+speed);
      animation.finish(); await promise;
    }
    context.speed=1;
  });

  await check('Production card turns avoid midpoint timers, DOM swaps and stepped physical motion',()=>{
    assert.ok(!turnSource.includes('setTimeout'));
    assert.ok(!turnSource.includes('steps('));
    assert.strictEqual((turnSource.match(/\.animate\(/g)||[]).length,1);
    assert.ok(css.includes('backface-visibility:hidden'));
    assert.ok(!css.includes('.card.flip-out'));
    assert.ok(!css.includes('@keyframes flipOut'));
  });

  await check('Hand, board, showdown and navigation paths use or cancel the shared lifecycle',()=>{
    assert.ok(production.includes('await turnCard(el, false, card, small'));
    assert.ok(engine.includes('turns.push(turnCard(boardEls[i]'));
    assert.ok(production.includes("g.phase==='showdown'?'showdown':'hole'"));
    assert.ok(production.includes('function clearAllCardDOM(){\n  DealFX.cancelAll();\n  cancelAllCardTurns();'));
    assert.ok(wiring.includes('function doLeaveTable(){\n  clearTimeout(autoDealT);\n  DealFX.cancelAll();\n  cancelAllCardTurns();'));
    assert.ok(!production.includes('function flipCard('));
    assert.ok(!engine.includes('flipCard('));
  });

  await check('The development fixture replays production code and samples against observed refresh',()=>{
    assert.ok(labHtml.includes('js/06-presentation.js'));
    assert.ok(lab.includes('turnCard(el,false,card'));
    assert.ok(lab.includes('refreshMs=median'));
    assert.ok(lab.includes('gapThreshold=observed ? observed*1.75'));
    assert.ok(!lab.includes('>34'));
    assert.ok(lab.includes('distinctTransforms:transforms.size'));
    assert.ok(lab.includes('activeTurns:activeCardTurns.size'));
  });

  await check('Card Turn remains shipped after the later build/cache marker advance',()=>{
    assert.ok(support.includes("const BUILD_VERSION = 'v0.32.8-dev · Chip Flow'"));
    assert.ok(serviceWorker.includes("const CACHE_NAME = 'poker-v32-8'"));
  });

  process.stdout.write('\n'+passed+' focused Card Turn checks passed.\n');
})().catch(error=>{ console.error(error); process.exitCode=1; });
