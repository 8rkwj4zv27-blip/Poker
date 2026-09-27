#!/usr/bin/env node
"use strict";

/* Pot shape checks (js/coin-world.js: potSlots, trayBox/holdIn; the pot
   tidy pass). Every shape (NEAT, PYRAMID, HEAP, TOWERS), for every pot size
   the game can show and many rolls, puts every coin somewhere: inside the
   tray, no two stack bases closer than a coin (faces touch, never sink into
   each other), and no stack taller than the room under the board. The bet
   spots' back row touches its front row too, and a coin nudged out of the
   tray is held inside it.
   Run: node validation/pot-shape-checks.js */

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }

// the coin world does nothing at load: a bare window is enough to run it
const el=()=>({ style:{}, classList:{ add(){}, remove(){} }, appendChild(){}, getBoundingClientRect:()=>({ left:0, top:0, right:0, bottom:0, width:0, height:0 }) });
const sandbox={ console, Math, performance:{ now:()=>0 }, setTimeout, clearTimeout,
  requestAnimationFrame:()=>0, matchMedia:()=>({ matches:false }),
  document:{ getElementById:()=>null, querySelector:()=>null, createElement:el, body:el() } };
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(read('js/coin-world.js'),sandbox,{ filename:'coin-world.js' });
const CW=sandbox.CoinWorld;
assert.ok(CW && CW.neatSlots && CW.trayBox && CW.holdIn,'CoinWorld exposes the pot helpers');

// the game's tray (390 x 844 phone: 210 x 62 well, plate under it)
const TRAY={ L:96, R:294, T:352.8, B:400.8 };
CW.setTray(Object.assign({},TRAY));
const pot=CW.zone('pot',195,384.8,9,15,44); pot.room=62.4;
const d=CW.D(), k=CW.trayBox(d), max=CW.LIMITS.more.pot;
const fake=n=>Array.from({ length:n },(_,i)=>({ colour:'gold', i }));

function layouts(shape,each){
  CW.OPT.potShape=shape;
  for (let n=1;n<=max;n++) for (let roll=0;roll<8;roll++){ CW.newPotShape(); each(n,CW.neatSlots(pot,fake(n))); }
  CW.OPT.potShape='mix';
}
CW.POT_SHAPES.forEach(shape=>{
  check(shape+': every coin placed, inside the tray, under the board',()=>{
    layouts(shape,(n,out)=>{
      assert.strictEqual(out.size,n,shape+' '+n+' coins: placed '+out.size);
      out.forEach(s=>{
        // a heap's stack leans at most 3px off its base
        assert.ok(s.x>=k.L-3.01 && s.x<=k.R+3.01 && s.y>=k.T-.01 && s.y<=k.B+.01,shape+' '+n+': a coin outside the tray at '+s.x+','+s.y);
        assert.ok(s.z+d*CW.HR()+2<=pot.room+(s.y-pot.cy)+CW.STEP(),shape+' '+n+': a stack into the board');
      });
    });
  });
  check(shape+': stacks touch, never sink into each other',()=>{
    layouts(shape,(n,out)=>{
      const bases=[...out.values()].filter(s=>s.n===0);
      for (let i=0;i<bases.length;i++) for (let j=i+1;j<bases.length;j++){
        const a=bases[i], c=bases[j], dist=Math.hypot(a.x-c.x,(a.y-c.y)*1.4);
        assert.ok(dist>=d-.01,shape+' '+n+': two stacks '+dist.toFixed(1)+'px apart (a coin is '+d+')');
      }
    });
  });
});

check('MIX picks every shape with odds, a tap never repeats the last',()=>{
  const seen={};
  for (let i=0;i<400;i++) seen[CW.newPotShape()]=1;
  CW.POT_SHAPES.forEach(s=>assert.ok(seen[s],'MIX never picked '+s));
  for (let i=0;i<100;i++){ const last=CW.potShape(); assert.notStrictEqual(CW.newPotShape(last),last); }
  CW.OPT.potMix={ pyramid:0, heap:0, rows:1, towers:0 };
  assert.strictEqual(CW.newPotShape('rows'),'rows','with one shape left, a tap keeps it');
  CW.OPT.potMix=Object.assign({},CW.BASE.potMix);
});

check('a bet spot\'s back row touches its front row',()=>{
  const spot=CW.zone('spot:1',100,200,7,5,16);
  const out=CW.neatSlots(spot,fake(10)), bases=[...out.values()].filter(s=>s.n===0);
  assert.ok(new Set(bases.map(s=>s.y)).size===2,'two rows');
  for (let i=0;i<bases.length;i++) for (let j=i+1;j<bases.length;j++){
    const a=bases[i], c=bases[j];
    assert.ok(Math.hypot(a.x-c.x,(a.y-c.y)*1.4)>=d-.01,'bet spot stacks sink into each other');
  }
});

check('a pot coin pushed out of the tray is held inside it; a spot coin is not',()=>{
  [[TRAY.L-20,380],[TRAY.R+30,380],[200,TRAY.T-10],[200,TRAY.T+2],[200,TRAY.B+15]].forEach(([x,y])=>{
    const b={ x, y, z:0, d, vx:0, vy:0, zone:pot };
    CW.holdIn(b);
    assert.ok(b.x>=k.L && b.x<=k.R && b.y>=k.T && b.y<=k.B,'held at '+b.x+','+b.y);
  });
  const b={ x:TRAY.L-20, y:380, z:0, d, vx:0, vy:0, zone:CW.zones['spot:1'] };
  CW.holdIn(b); assert.strictEqual(b.x,TRAY.L-20);
});

check('the pot lab stays out of the game',()=>{
  const indexHtml=read('index.html'), sw=read('sw.js');
  ['pot-lab'].forEach(n=>{ assert.ok(!indexHtml.includes(n),'index.html links '+n); assert.ok(!sw.includes(n),'sw.js precaches '+n); });
});

process.stdout.write('\n'+passed+' Pot shape checks passed.\n');
