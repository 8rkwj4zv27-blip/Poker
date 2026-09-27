#!/usr/bin/env node
"use strict";

/* Showdown checks (js/showdown.js, v0.42.0): the end-of-hand pass pays
   exactly what the shipped sequence paid. Its copies of handleShowdown()
   and runShowdownAwardSequence() keep the production pot, share, mood and
   settlement code verbatim (comments and spacing aside); these checks
   compare them, and run the display merge it settles with.
   Run: node validation/showdown-checks.js */

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const indexHtml=read('index.html'), sw=read('sw.js');
const engine=read('js/05-game-engine.js'), pres=read('js/06-presentation.js');
const sd=read('js/showdown.js'), sdCss=read('css/showdown.css'), support=read('js/02-support-systems.js');

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }

// code with its comments and every space taken out
const norm=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"\\])\/\/[^\n]*/g,'$1').replace(/\s+/g,'');
// a function's body, by brace matching from its declaration
function fnBody(src,decl){
  const at=src.indexOf(decl); assert.ok(at>=0,'missing '+decl);
  let i=src.indexOf('{',at), d=0, j=i;
  do{ if(src[j]==='{')d++; else if(src[j]==='}')d--; j++; }while(d);
  return src.slice(at,j);
}
// the text between two markers (both normalised)
function between(src,from,to){
  const n=norm(src), a=n.indexOf(norm(from)); assert.ok(a>=0,'missing '+from);
  const b=n.indexOf(norm(to),a); assert.ok(b>a,'missing '+to);
  return n.slice(a,b);
}
const engShow=fnBody(engine,'async function handleShowdown(){');
const sdShow=fnBody(sd,'async function handleShowdownSD(){');
const engAward=fnBody(pres,'async function runShowdownAwardSequence(');
const sdAward=fnBody(sd,'async function awardSequence(');

check('Loaded by the game (before the CRT component) and precached offline',()=>{
  const links=[...indexHtml.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]);
  assert.ok(links.includes('css/showdown.css') && links.indexOf('css/showdown.css')<links.indexOf('css/crt.css'),'css/showdown.css must load before css/crt.css');
  const scripts=[...indexHtml.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);
  ['js/05-game-engine.js','js/06-presentation.js','js/coin-world.js','js/coin-table.js','js/enemy-cards.js','js/crt.js'].forEach(f=>{
    if(scripts.includes(f)) assert.ok(scripts.indexOf(f)<scripts.indexOf('js/showdown.js'),'js/showdown.js must load after '+f);
  });
  [...indexHtml.matchAll(/(css\/showdown\.css|js\/showdown\.js)\?v=([^"]+)/g)].forEach(m=>assert.ok(sw.includes("'./"+m[1]+'?v='+m[2]+"'"),'sw.js must precache '+m[0]));
});

check('Build and offline cache markers are synchronised for the Showdown',()=>{
  const build=(support.match(/BUILD_VERSION\s*=\s*'v0\.(\d+)\.(\d+)/)||[]).slice(1), cache=(sw.match(/CACHE_NAME\s*=\s*'poker-v(\d+)-(\d+)'/)||[]).slice(1);
  assert.deepStrictEqual(build,cache,'BUILD_VERSION and CACHE_NAME must match');
  assert.ok(Number(build[0])>=42,'the Showdown shipped in v0.42');
});

check('Pot layers, winners, shares and odd chips are the production code verbatim',()=>{
  const a=between(engShow,'const potResults = [];','const mainResult = potResults[0];');
  const b=between(sdShow,'const potResults = [];','const mainResult = potResults[0];');
  assert.strictEqual(b,a,'the pot/share block in js/showdown.js has drifted from handleShowdown() in js/05-game-engine.js');
  assert.ok(norm(engShow).includes('constpots=computePots(g.players);') && norm(sdShow).includes('constpots=computePots(g.players);'),'both must split the pot with computePots()');
  assert.ok(norm(sdShow).includes(norm('const contenders = g.players.filter(p => p.inHand && !p.folded && !p.eliminated);')),'an eliminated seat must never contend');
});

check('Moods, reactions and table talk after the verdict are the production code verbatim',()=>{
  const a=between(engShow,'const bbv = g.bigBlind;','mergePotResultsForDisplay(potResults)');
  const b=between(sdShow,'const bbv = g.bigBlind;','mergePotResultsForDisplay(potResults)');
  assert.strictEqual(b,a,'the reaction block in js/showdown.js has drifted from handleShowdown()');
  assert.ok(norm(sdShow).endsWith(norm('await runShowdownAwardSequence(potResults, contenders);}')),'the copy must hand over to runShowdownAwardSequence()');
});

check('Settlement pays each share and empties the pot the shipped way, then finishes the hand the same',()=>{
  const n=norm(sdAward), e=norm(engAward);
  assert.ok(e.includes('if(w)w.chips+=s.amount;') && e.includes('g.pot=Math.max(0,g.pot-pot.amount);'),'the production settlement has changed: update js/showdown.js to match');
  assert.ok(n.includes('r.winnerShares.forEach(s=>{constw=byId(s.id);if(w)w.chips+=s.amount;});g.pot=Math.max(0,g.pot-r.amount);'),'the copy must settle every share and take it off the pot');
  // every display pot is settled exactly once, whichever order it plays
  assert.ok(n.includes('constshown=mergePotResultsForDisplay(potResults);') && n.includes('shown.forEach(settle);'),'the whole-pot award must settle every display pot');
  assert.ok((n.match(/settle\(r\);/g)||[]).length===2 && n.includes('for(leti=shown.length-1;i>=0;i--){constr=shown[i];'),'pot by pot, each display pot must settle once');
  assert.ok(n.includes("{type:'showdown',potResults,contenders,winnerIds}") && n.includes("{type:'foldwin',winner:g.players.find(p=>p.id===potResults[0].winnerIds[0]),amount:potResults[0].amount}"),'the outcome handed to finishHand() must match');
  assert.ok(n.includes('awaitfinishHand(outcome);') && e.includes('awaitfinishHand(outcome);'),'both must finish through finishHand()');
  assert.ok(n.includes('constfoldWin=!(potResults.length!==1||potResults[0].hand!==null);') && e.includes('constwasShowdown=potResults.length!==1||potResults[0].hand!==null;'),'fold wins must be told apart the same way');
  // the shipped sequence's arcade ceremony is off; if it comes back the copy must learn it
  assert.ok(/const ARCADE_XP_ON = false;/.test(read('js/04-modes-and-scoring.js')),'ARCADE_XP_ON is on: js/showdown.js does not run runHumanPotSmashCeremony()');
  // no coin table: the shipped sequence runs
  assert.ok(norm(sd).includes('return!coinsOn()?orig.award.apply(this,arguments):awardSequence(potResults,contenders);'),'without the coin table the shipped award must run');
});

check('The display merge it settles with keeps every chip and every share',()=>{
  const ctx={}; vm.createContext(ctx);
  vm.runInContext(fnBody(engine,'function mergePotResultsForDisplay(')+';this.merge=mergePotResultsForDisplay;',ctx);
  let seed=7; const rnd=()=>{ seed=(seed*1103515245+12345)%2147483648; return seed/2147483648; };
  for(let t=0;t<500;t++){
    const ids=['you','a','b','c','d'], layers=[]; let group=0;
    const count=1+Math.floor(rnd()*5);
    for(let i=0;i<count;i++){
      if(i && rnd()<.5) group++;
      const winners=ids.filter(()=>rnd()<.4); if(!winners.length) winners.push('a');
      const amount=1+Math.floor(rnd()*5000), share=Math.floor(amount/winners.length), rem=amount-share*winners.length;
      layers.push({ group, amount, winnerIds:winners, winnerShares:winners.map((id,k)=>({ id, name:id, amount:share+(k<rem?1:0) })) });
    }
    const before=JSON.stringify(layers);
    const byId=list=>{ const m={}; list.forEach(r=>r.winnerShares.forEach(s=>m[s.id]=(m[s.id]||0)+s.amount)); return m; };
    const shown=ctx.merge(layers);
    assert.deepStrictEqual(byId(shown),byId(layers),'a merged display pot changed a share');
    assert.strictEqual(shown.reduce((s,r)=>s+r.amount,0),layers.reduce((s,r)=>s+r.amount,0),'a merged display pot changed the total');
    assert.strictEqual(JSON.stringify(layers),before,'the merge must not change the pot results it reads');
  }
});

check('The player\'s choices: Settings → Showdown, saved with the rest, read through one map',()=>{
  const seg=(id,vals)=>{ const m=indexHtml.match(new RegExp('id="'+id+'"[\\s\\S]*?</div>')); assert.ok(m,'Settings is missing #'+id); const got=[...m[0].matchAll(/data-v="([^"]+)"/g)].map(x=>x[1]); assert.deepStrictEqual(got,vals,'#'+id+' keys'); return m[0]; };
  const defaults={ sdSmash:'monster', sdForce:'huge', sdBounce:'lots', sdHeat:'ember', sdPickup:'flip', sdWinChance:false, sdAwardPot:'always' };
  [['sd-smash-seg','sdSmash',['monster','big','every','off']],['sd-force-seg','sdForce',['big','huge','max']],['sd-bounce-seg','sdBounce',['few','lots','endless']],
   ['sd-heat-seg','sdHeat',['ember','allin','white']],['sd-pickup-seg','sdPickup',['flip','ripple','all']],['sd-award-seg','sdAwardPot',['always','mine','auto']]].forEach(([id,key,vals])=>{
    const html=seg(id,vals);
    assert.ok(new RegExp('data-v="'+defaults[key]+'" class="active"').test(html),'#'+id+' must mark the default '+defaults[key]);
    assert.ok(sd.includes("['"+id+"','"+key+"']"),'js/showdown.js must wire #'+id+' to settings.'+key);
    vals.filter(v=>v!=='off').forEach(v=>assert.ok(sd.includes("'"+v+"'"),'js/showdown.js does not know '+key+' = '+v));
  });
  Object.entries(defaults).forEach(([k,v])=>assert.ok(new RegExp(k+':'+(typeof v==='string'?"'"+v+"'":v)).test(support),'DEFAULT_SETTINGS must set '+k+' to '+v));
  assert.ok(/id="sw-sd-winchance" role="switch" aria-checked="false"/.test(indexHtml) && sd.includes("settings.sdWinChance ? 'meter' : 'off'"),'the win-chance switch must be wired, off by default');
  assert.ok(/let settings = Object\.assign\(\{\}, DEFAULT_SETTINGS, Store\.get\('felt\.settings'/.test(support),'an old save must pick up the new defaults');
  assert.ok(sd.includes('saveSettings()') && !/localStorage/.test(sd),'the choices save through saveSettings(), never straight to storage');
});

check('Presentation only, on the shared parts, and Reduced Motion safe',()=>{
  assert.ok(!/data-sd-/.test(sd+sdCss+indexHtml),'production must not use the lab\'s data-sd-* attributes');
  ['showdown-beats','showdown-lab'].forEach(n=>{ assert.ok(!indexHtml.includes(n),'index.html links '+n); assert.ok(!sw.includes(n),'sw.js precaches '+n); });
  assert.ok(sd.includes("m.className = 'sd-meter crt'") && sd.includes('class="crt-caption"'),'the win-chance meter must be the CRT component with its own captions');
  assert.ok(sd.includes("put('sd-potplate pot-chip'"),'the side-pot plates must reuse the pot plate (.pot-chip)');
  assert.ok(sd.includes('CRT.glitch(hs)') && !/hand-strength/.test(sdCss),'your hand readout takes the CRT\'s own glitch, never a local style');
  assert.ok(sdCss.includes('[data-motion="off"]') && sdCss.includes('prefers-reduced-motion') && sd.includes('motionOff()'),'the Showdown must honour Reduced Motion');
  [...sdCss.matchAll(/animation:\s*[a-zA-Z]+ [^;]*/g)].forEach(m=>assert.ok(/steps\(|infinite/.test(m[0])||/sdHum/.test(m[0]),'Showdown animation must step: '+m[0]));
  // the engine asks the one player not all in to act each street: when
  // that's you, the runout must not lock the console over your turn
  assert.ok(/const isRunout = g => \{[^}]*!free\.some\(p => p\.isHuman\)/.test(sd) && norm(engine).includes('constneedToAct=contenders.filter(p=>!p.allIn);'),'a runout must never lock the console while you still have to act');
  assert.ok(sd.includes('if (orig.installed) return;') && sd.includes('orig.handleShowdown = handleShowdown;'),'the install must be once, keeping the shipped functions');
});

process.stdout.write('\n'+passed+' focused Showdown checks passed.\n');
