#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const fx=fs.readFileSync(path.join(root,'js/chip-payout-options.js'),'utf8');
const lab=fs.readFileSync(path.join(root,'js/showdown-rail-lab.js'),'utf8');
const html=fs.readFileSync(path.join(root,'showdown-rail-lab.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/showdown-rail-lab.css'),'utf8');
const entry=fs.readFileSync(path.join(root,'chip-motion-lab.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
let passed=0;
function check(name,fn){fn();passed++;process.stdout.write('PASS  '+name+'\n');}
check('The lab exposes four polished physical collection personalities',()=>{
  ['magnet','counter','gather','overload'].forEach(id=>assert.ok(fx.includes(id+":'")));
  ['Magnetic Rack','Casino Counter','Croupier Gather','Jackpot Overload'].forEach(name=>assert.ok(html.includes(name)));
  assert.strictEqual((html.match(/data-payout-option=/g)||[]).length,4);
});
check('The same real chip travels from pot to a reserved bank tower slot',()=>{
  ['takeChipFromPile','claimDestSlot','settleSlot','appendChild(c.el)'].forEach(term=>assert.ok(fx.includes(term)));
  assert.ok(fx.includes("classList.add('payout-physics-chip')"));
  assert.ok(!fx.includes('cloneNode'));assert.ok(!fx.includes('style.opacity'));
});
check('The journey is one continuous fixed-timestep compositor loop',()=>{
  assert.strictEqual((fx.match(/requestAnimationFrame\(tick\)/g)||[]).length,2);
  assert.ok(fx.includes('translate3d('));assert.ok(fx.includes("willChange='transform'"));
  assert.ok(fx.includes('Math.min(34,now-last)'));assert.ok(!fx.includes('steps('));
});
check('The choreography owns smash, felt, suction, bank and stack',()=>{
  ['impactPlate','resolveFeltBounds','resolveBankBounds','resolvePairs','enterBank','beginStack'].forEach(term=>assert.ok(fx.includes(term)));
  ["onPhase('smash')","onPhase('suction')","onPhase('bank')","onPhase('stack')"].forEach(term=>assert.ok(fx.includes(term)));
  assert.ok(fx.includes('feltImpactBump'));assert.ok(fx.includes('openHatch'));assert.ok(fx.includes('closeHatch'));
});
check('Cards and dashboard are physical obstacles with one legal bank gate',()=>{
  ['tableObstacles','resolveTableObstacles','resolveDashboard','#board .card,.seat .seat-cards .card','#dealer-deck .card','screenY=c.y-c.lift',"gate={center:entryX,left:bankRect.left+11,right:bankRect.right-11}"].forEach(term=>assert.ok(fx.includes(term)));
  assert.ok(fx.includes("feltChips.forEach(c=>{if(c.state!=='felt')return;resolveTableObstacles"));
});
check('Every style owns a visibly different multi-point entry route',()=>{
  ['routeFor','collectionDelay',"o.variant==='counter'","o.variant==='gather'","o.variant==='overload'"].forEach(term=>assert.ok(fx.includes(term)));
  assert.ok(fx.includes('routeIndex++'));assert.ok(fx.includes('point.final'));
});
check('A real pot chip owns the amplified hero-smash trajectory',()=>{
  ['hero.hero=true','is-hero-chip','heroPower','650+random()*170','760+random()*360'].forEach(term=>assert.ok((fx+css).includes(term)));
  assert.ok(!fx.includes('cloneNode'));
});
check('Small through massive pots have scaled choreography',()=>{
  ["6:{name:'small'","14:{name:'normal'","24:{name:'big'","32:{name:'massive'"].forEach(term=>assert.ok(fx.includes(term)));
  assert.ok(fx.includes('impact:1.24'));assert.ok(fx.includes("tier.name==='massive'?690:tier.name==='small'?470:560"));
});
check('No portal or fade-based teleport remains',()=>{
  assert.ok(!css.includes('payout-collection-pulse'));assert.ok(!fx.includes('payout-collection-pulse'));
  assert.ok(!fx.includes('style.opacity'));
});
check('Cancellation and exceptional recovery are observable and clean',()=>{
  ['o.nodes.forEach(n=>n.remove())','o.placeholders.forEach(n=>n.remove())','o.layers.forEach(n=>n.remove())'].forEach(term=>assert.ok(fx.includes(term)));
  assert.ok(fx.includes('o.recovered=true'));assert.ok(fx.includes('recovered:o.recovered'));
  assert.ok(lab.includes("recovered?' · recovery used'"));assert.ok(lab.includes('PayoutOptionFX.cancel()'));
});
check('Each phase can be isolated and seeded chaos replayed',()=>{
  ['value="full"','value="smash"','value="bank"','value="stack"','sdr-replay-seed','sdr-reroll-seed','payoutSeed'].forEach(term=>assert.ok((html+lab).includes(term)));
  ['value="6"','value="14"','value="24"','value="32"'].forEach(value=>assert.ok(html.includes(value)));
});
check('Reduced motion settles directly without simulated flight',()=>{
  const start=fx.indexOf("if(document.body.dataset.motion==='off')"),end=fx.indexOf('if(stage===',start),reduced=fx.slice(start,end);
  assert.ok(reduced.includes('settleChip'));assert.ok(reduced.includes('durationMs:0,reduced:true'));assert.ok(!reduced.includes('requestAnimationFrame'));
});
check('The instrument reports completion and frame pacing',()=>{
  ['landed','residue','durationMs','recovered','averageMs','longestMs','over34','distinctTransforms'].forEach(term=>assert.ok((fx+lab).includes(term)));
});
check('The exploration remains isolated from production and persistence',()=>{
  assert.ok(entry.includes('chip-payout=1&source=embedded'));assert.ok(!index.includes('chip-payout-options.js'));
  assert.ok(!sw.includes('chip-payout-options.js'));assert.ok(!sw.includes('chip-motion-lab.html'));
  assert.ok(!fx.includes('localStorage'));assert.ok(!fx.includes('saveGame'));
});
process.stdout.write('\n'+passed+' focused Pot Collection Lab checks passed.\n');
