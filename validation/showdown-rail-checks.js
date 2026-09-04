#!/usr/bin/env node
"use strict";

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const poker=fs.readFileSync(path.join(root,'js/01-poker-math.js'),'utf8');
const modelSource=fs.readFileSync(path.join(root,'js/showdown-rail-model.js'),'utf8');
const labSource=fs.readFileSync(path.join(root,'js/showdown-rail-lab.js'),'utf8');
const html=fs.readFileSync(path.join(root,'showdown-rail-lab.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/showdown-rail-lab.css'),'utf8');
const production=fs.readFileSync(path.join(root,'js/06-presentation.js'),'utf8');
const foundationCss=fs.readFileSync(path.join(root,'css/01-foundation.css'),'utf8');
const productionCss=fs.readFileSync(path.join(root,'css/02-screens.css'),'utf8');
const actionCss=fs.readFileSync(path.join(root,'css/03-action-console.css'),'utf8');
const support=fs.readFileSync(path.join(root,'js/02-support-systems.js'),'utf8');
const serviceWorker=fs.readFileSync(path.join(root,'sw.js'),'utf8');

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }

const context={console,setTimeout,clearTimeout};
vm.createContext(context);
vm.runInContext(poker+'\n'+modelSource+`\nglobalThis.railApi={
  fixtures:SHOWDOWN_RAIL_FIXTURES,byId:showdownRailFixtureById,build:buildShowdownRailModel,
  order:showdownRailOrder,treatments:showdownRailTreatments,evaluate5:evaluate5,compare:compareHands,cardKey:cardKey
};`,context);
const api=context.railApi;
const plain=value=>JSON.parse(JSON.stringify(value));
const fixture=id=>api.byId(id);
const model=(id,award)=>plain(api.build(fixture(id),award));
const values=id=>model(id).cards.map(c=>c.value);
const strongCount=id=>model(id).cards.filter(c=>c.treatment==='strong').length;

check('The harness contains every required deterministic fixture',()=>{
  const ids=plain(api.fixtures).map(f=>f.id);
  ['human-pair','opponent-two-pair','trips','mixed-straight','wheel','flush','full-house','quads',
   'board-split','split-hole-sources','side-pot-winner','hidden-opponent'].forEach(id=>assert.ok(ids.includes(id),id));
  assert.ok(ids.length>=12);
});

check('Every rail uses the production evaluator exact five-card result',()=>{
  api.fixtures.forEach(f=>{
    const m=api.build(f);
    assert.strictEqual(m.cards.length,5,f.id);
    const evaluated=api.evaluate5(m.cards);
    assert.strictEqual(api.compare(evaluated,m.winnerHands[0].result),0,f.id);
    const available=new Set(f.board.concat(f.players.find(p=>p.id===m.winnerIds[0]).hole).map(api.cardKey));
    m.cards.forEach(card=>assert.ok(available.has(card.key),f.id+' '+card.key));
  });
});

check('High card is descending with the leading card first',()=>{
  assert.deepStrictEqual(values('high-card'),[14,13,12,9,7]);
  assert.strictEqual(strongCount('high-card'),1);
});

check('Pair is grouped first with descending kickers',()=>{
  assert.deepStrictEqual(values('human-pair'),[14,14,12,9,7]);
  assert.strictEqual(strongCount('human-pair'),2);
});

check('Two pair is higher pair, lower pair, then kicker',()=>{
  assert.deepStrictEqual(values('opponent-two-pair'),[13,13,9,9,14]);
  assert.strictEqual(strongCount('opponent-two-pair'),4);
});

check('Three of a kind is grouped before descending kickers',()=>{
  assert.deepStrictEqual(values('trips'),[8,8,8,14,13]);
  assert.strictEqual(strongCount('trips'),3);
});

check('Mixed-source straight is a descending readable sequence',()=>{
  assert.deepStrictEqual(values('mixed-straight'),[12,11,10,9,8]);
  assert.strictEqual(strongCount('mixed-straight'),5);
  assert.ok(new Set(model('mixed-straight').cards.map(c=>c.source)).size>1);
});

check('Wheel straight is visually 5-4-3-2-A',()=>{
  const m=model('wheel');
  assert.deepStrictEqual(m.cards.map(c=>c.rank),['5','4','3','2','A']);
  assert.strictEqual(m.handName,'Straight, Five high');
});

check('Flush is descending and all five cards are strong',()=>{
  assert.deepStrictEqual(values('flush'),[14,12,9,7,2]);
  assert.strictEqual(strongCount('flush'),5);
});

check('Full house puts the trips before the pair and marks all five strong',()=>{
  assert.deepStrictEqual(values('full-house'),[6,6,6,8,8]);
  assert.strictEqual(strongCount('full-house'),5);
});

check('Four of a kind puts four matching cards before the kicker',()=>{
  assert.deepStrictEqual(values('quads'),[11,11,11,11,14]);
  assert.strictEqual(strongCount('quads'),4);
});

check('Straight flush is ordered and treats all five as the made hand',()=>{
  assert.deepStrictEqual(values('straight-flush'),[10,9,8,7,6]);
  assert.strictEqual(strongCount('straight-flush'),5);
});

check('Board-play split data names both winners and shares one exact five',()=>{
  const m=model('board-split');
  assert.strictEqual(m.split,true);
  assert.strictEqual(m.sharedBestFive,true);
  assert.deepStrictEqual(m.winnerIds,['you','mara']);
  assert.ok(m.cards.every(c=>c.source==='board'));
  assert.strictEqual(m.winnerLabel,'YOU + MARA SPLIT');
});

check('Different-source split data retains both exact winner hands',()=>{
  const m=model('split-hole-sources');
  assert.strictEqual(m.split,true);
  assert.strictEqual(m.sharedBestFive,false);
  assert.strictEqual(m.winnerHands.length,2);
  assert.ok(m.winnerHands[0].cards.some(c=>c.source==='you'));
  assert.ok(m.winnerHands[1].cards.some(c=>c.source==='mara'));
});

check('Main and side pots can be modelled independently with different winners',()=>{
  const main=model('side-pot-winner','main'), side=model('side-pot-winner','side');
  assert.deepStrictEqual(main.winnerIds,['you']);
  assert.deepStrictEqual(side.winnerIds,['mara']);
  assert.strictEqual(main.award.text,'Main Pot · 900');
  assert.strictEqual(side.award.text,'Side Pot · 760');
});

check('Hidden opponent fixture requires hole-card reveal from the winning seat',()=>{
  const f=fixture('hidden-opponent'), m=model('hidden-opponent');
  assert.strictEqual(f.players.find(p=>p.id==='mara').hidden,true);
  assert.ok(m.cards.some(c=>c.source==='mara'));
  assert.strictEqual(m.winnerLabel,'MARA WINS');
});

check('Replay cancellation owns and cancels every active animation',()=>{
  const reset=labSource.slice(labSource.indexOf('function cancelActivePresentation'),labSource.indexOf('function waitFrame'));
  assert.ok(reset.includes('activeAnimations.forEach'));
  assert.ok(reset.includes('animation.cancel()'));
  assert.ok(reset.includes('activeAnimations.clear()'));
  assert.ok(reset.includes("destinations.replaceChildren()"));
  assert.ok(reset.includes("el.style.visibility=''"));
  assert.ok(reset.includes("classList.remove('sdr-winner-seat')"));
});

check('Fixture changes start from full presentation cleanup',()=>{
  const select=labSource.slice(labSource.indexOf('async function selectFixture'),labSource.indexOf('async function init'));
  const render=labSource.slice(labSource.indexOf('function renderFixtureState'),labSource.indexOf('function sourceFor'));
  assert.ok(select.includes('renderFixtureState()'));
  assert.ok(render.includes('cancelActivePresentation()'));
  assert.ok(render.includes('lastSample=null'));
});

check('Reduced motion crossfades directly without card travel, stagger or flip animation',()=>{
  const replay=labSource.slice(labSource.indexOf('async function replay'),labSource.indexOf('function setMotion'));
  const reduced=labSource.slice(labSource.indexOf('async function revealReduced'),labSource.indexOf('function settlePresentation'));
  assert.ok(replay.includes('reduced?await revealReduced(entries,token):await animateWinningFive(entries,token)'));
  assert.ok(reduced.includes("entry.shell.classList.add('is-ready')"));
  assert.ok(reduced.includes("entry.flipper.style.transform=entry.startsDown?'rotateY(180deg)':'none'"));
  assert.ok(!reduced.includes('staggerMs'));
  assert.ok(!reduced.includes('entry.shell.animate'));
  assert.ok(!reduced.includes('entry.flipper.animate'));
});

check('One JavaScript stagger source launches all five inside 100ms',()=>{
  assert.ok(labSource.includes('staggerMs:22'));
  assert.ok(labSource.includes('const delay=index*TIMING.staggerMs'));
  assert.ok(!css.includes('--stagger'));
  assert.ok(!/transition-delay|animation-delay/.test(css));
  assert.ok(4*22<=100);
});

check('Settled result is gated on completion of every travelling-card animation',()=>{
  const animateStart=labSource.indexOf('async function animateWinningFive');
  const allFinished=labSource.indexOf('await Promise.all(cardAnimations.map(track))',animateStart);
  const settleCall=labSource.indexOf('settlePresentation()',labSource.indexOf('async function replay'));
  assert.ok(allFinished>animateStart);
  assert.ok(settleCall>allFinished);
  assert.ok(labSource.includes('if (!cardsReady||token!==runToken) return'));
});

check('Physical rail motion uses continuous easing and no stepped selectors',()=>{
  assert.ok(!/steps\s*\(/i.test(css));
  assert.ok(!/steps\s*\(/i.test(labSource));
  assert.ok(labSource.includes("easing:'cubic-bezier(.32,0,.55,.35)'"));
  assert.ok(labSource.includes("easing:'cubic-bezier(.2,.72,.24,1)'"));
  assert.ok(!/filter\s*:|backdrop-filter\s*:/.test(css));
});

check('Card flights meet the continuous travel and launch-window timing contract',()=>{
  assert.ok(labSource.includes('flightMinMs:440'));
  assert.ok(labSource.includes('flightMaxMs:520'));
  assert.ok(labSource.includes('readableHoldMs:1050'));
  assert.ok(labSource.includes("{transform:'translate(0,-2px) scale(1.01)',offset:.95"));
});

check('Hidden cards use a true 3D face-up rotation with both faces mounted',()=>{
  assert.ok(labSource.includes("productionCard(card,true,'sdr-flight-face sdr-flight-back')"));
  assert.ok(labSource.includes("productionCard(card,false,'sdr-flight-face sdr-flight-front')"));
  assert.ok(labSource.includes("{transform:'rotateY(180deg)',offset:.72}"));
  assert.ok(css.includes('backface-visibility:hidden'));
});

check('The frame sampler records intervals, long gaps and transform diversity',()=>{
  assert.ok(labSource.includes('timestamps.push(now)'));
  assert.ok(labSource.includes('transforms.add(getComputedStyle(probe).transform)'));
  assert.ok(labSource.includes('intervals.filter(v=>v>34).length'));
  assert.ok(labSource.includes('distinctTransforms:transforms.size'));
});

check('The isolated page mounts the real production table without live wiring',()=>{
  assert.ok(/<script src="js\/01-poker-math\.js(?:\?[^\"]+)?"><\/script>/.test(html));
  assert.ok(/<script src="js\/05-game-engine\.js(?:\?[^\"]+)?"><\/script>/.test(html));
  assert.ok(/<script src="js\/06-presentation\.js(?:\?[^\"]+)?"><\/script>/.test(html));
  assert.ok(!html.includes('js/07-ui-wiring.js'));
  assert.ok(!html.includes('js/08-dev-mode.js'));
  assert.ok(labSource.includes("fetch('index.html',{cache:'no-store'})"));
  assert.ok(labSource.includes("doc.querySelector('#table-screen')"));
  assert.ok(!html.includes('class="seat'));
  assert.ok(labSource.includes('cardClass(faceDown,card,false)'));
  assert.ok(labSource.includes('cardInner(card)'));
});

check('Inspection lane reserves exactly five crisp responsive card positions',()=>{
  assert.ok(labSource.includes('id="sdr-destinations"'));
  assert.ok(css.includes('grid-template-columns:repeat(5,44px)'));
  assert.ok(css.includes('grid-template-columns:repeat(5,42px)'));
  assert.ok(!css.includes('overflow-x:auto'));
});

check('In-table presentation omits every rejected HUD element',()=>{
  assert.ok(!html.includes('>WINNING FIVE<'));
  assert.ok(!css.includes('WINNING FIVE'));
  ['sdr-connection','sdr-result-copy','sdr-pot','connecting-beam'].forEach(name=>{
    assert.ok(!html.includes(name),name+' html');
    assert.ok(!css.includes(name),name+' css');
  });
  assert.ok(!css.includes('opaque'));
});

check('Result and payout reuse production CRT, pot-smash and opponent payout paths',()=>{
  assert.ok(labSource.includes("paintCRT($('banner')"));
  assert.ok(labSource.includes('await runPotSmashSequence('));
  assert.ok(labSource.includes('await payoutTo(others[i],count)'));
  assert.ok(labSource.includes('await clearWinningFive(token)'));
});

check('Prototype state remains memory-only and never invokes save APIs',()=>{
  ['localStorage.setItem','Store.set','saveSettings(','saveStats(','serialize'].forEach(write=>assert.ok(!labSource.includes(write),write));
  assert.ok(labSource.includes('storageUnchanged:storageSnapshot()===storageBaseline'));
  assert.ok(html.includes('memory-only'));
});

check('Live showdown now awaits the exact-five rail before winner and result treatment',()=>{
  const sequence=production.slice(production.indexOf('async function runShowdownAwardSequence'),production.indexOf('await finishHand(outcome)'));
  const rail=sequence.indexOf('await presentShowdownRail(main)');
  const winner=sequence.indexOf('winnerIds.forEach(id=>celebrateWinnerSeat(id))');
  const result=sequence.indexOf('showHudResultConsole(potResults)');
  assert.ok(rail!==-1 && winner>rail && result>winner);
  assert.ok(sequence.includes('if (main.cards)'));
});

check('Live rail reuses resolved pot cards and production card rendering',()=>{
  const build=production.slice(production.indexOf('function buildShowdownRail'),production.indexOf('async function presentShowdownRail'));
  assert.ok(build.includes('main.cards.length!==5'));
  assert.ok(build.includes('arrangeHandForDisplay(main.cat,main.cards)'));
  assert.ok(build.includes('strongWinningCardKeys(handRes.result.cat,handRes.result.tiebreak,handRes.cards)'));
  assert.ok(build.includes('cardClass(false,card,false)'));
  assert.ok(build.includes('cardInner(card)'));
  assert.ok(!build.includes('evaluate5('));
  assert.ok(!build.includes('evaluate7'));
});

check('Live rail has one stagger source and awaits every card before settling',()=>{
  const present=production.slice(production.indexOf('async function presentShowdownRail'),production.indexOf('function showdownRailResultCopy'));
  assert.ok(production.includes('staggerMs:22'));
  assert.ok(present.includes('const delay=index*SHOWDOWN_RAIL_TIMING.staggerMs'));
  assert.ok(present.includes('await Promise.all(cardAnimations.map(item=>trackShowdownRailAnimation(item.animation)))'));
  assert.ok(present.lastIndexOf("lane.classList.add('is-settled')")>present.indexOf('await Promise.all'));
  assert.ok(!/transition-delay|animation-delay/.test(productionCss.slice(productionCss.indexOf('/* RAIL FIVE'),productionCss.indexOf('.card.win-card'))));
});

check('Jackpot Sweep locks the winning five with continuous physical lift',()=>{
  const build=production.slice(production.indexOf('function buildShowdownRail'),production.indexOf('async function presentShowdownRail'));
  const present=production.slice(production.indexOf('async function presentShowdownRail'),production.indexOf('function showdownRailResultCopy'));
  assert.ok(production.includes('lockMs:430'));
  assert.ok(production.includes('lockStaggerMs:42'));
  assert.ok(production.includes('shineMs:360'));
  assert.ok(production.includes('shineStaggerMs:66'));
  assert.ok(production.includes('stampMs:340'));
  assert.ok(build.includes("if (shell.dataset.treatment==='strong')"));
  assert.ok(build.includes("shineClip.className='showdown-card-shine-clip'"));
  assert.ok(build.includes("shine.className='showdown-card-shine'"));
  assert.ok(build.includes("stamp.className='showdown-hand-stamp'"));
  assert.ok(build.includes("handText.category||main.hand"));
  assert.ok(present.includes("const strong=entry.shell.dataset.treatment==='strong'"));
  assert.ok(present.includes('const finalY=strong?-10:-2'));
  assert.ok(present.includes("transform:'perspective(800px) translate3d("));
  assert.ok(present.includes('const strongEntries=entries.filter(entry=>entry.shine)'));
  assert.ok(present.includes('const shineAnimations=strongEntries.map('));
  assert.ok(present.includes('const stampAnimation=stamp.animate(['));
  assert.ok(present.includes('await Promise.all(['));
  assert.ok(present.indexOf("lane.classList.add('is-settled')")<present.indexOf('const lockAnimations='));
  assert.ok(present.indexOf("lane.classList.add('is-stamped')")>present.indexOf('const shineAnimations='));
});

check('Jackpot Sweep uses gold made cards, green kickers and gives the actual winner dominant table focus',()=>{
  const railCss=productionCss.slice(productionCss.indexOf('/* RAIL FIVE'),productionCss.indexOf('.card.win-card'));
  assert.ok(foundationCss.includes('--pc-lamp-amber-hi:#FFE49B'));
  assert.ok(foundationCss.includes('--pc-lamp-green-hi:#B9EACB'));
  assert.ok(railCss.includes('translate3d(0,-10px,8px)'));
  assert.ok(railCss.includes('border-color:var(--pc-lamp-amber-hi)'));
  assert.ok(railCss.includes('border-color:var(--pc-lamp-green-hi)'));
  assert.ok(railCss.includes('.showdown-card-shine-clip'));
  assert.ok(railCss.includes('.showdown-card-shine'));
  assert.ok(railCss.includes('.showdown-hand-stamp'));
  assert.ok(!railCss.includes('.showdown-rail-sweep'));
  assert.ok(railCss.includes('.felt.showdown-winner-locked .seat:not(.winner):not(.out)'));
  assert.ok(actionCss.includes('.seat.winner:not(.you) .seat-card{'));
  assert.ok(actionCss.includes('0 0 0 4px var(--pc-lamp-amber-hi)'));
  assert.ok(actionCss.includes('#hud-frame.hud-frame-win-flash{'));
  const sequence=production.slice(production.indexOf('async function runShowdownAwardSequence'),production.indexOf('await finishHand(outcome)'));
  assert.ok(sequence.indexOf("felt.classList.add('showdown-winner-locked')")>sequence.indexOf('winnerIds.forEach(id=>celebrateWinnerSeat(id))'));
  const cleanup=production.slice(production.indexOf('function clearAllCardDOM(){'),production.indexOf('async function muckCards'));
  assert.ok(cleanup.includes("felt.classList.remove('showdown-winner-locked')"));
  assert.ok(labSource.includes("felt.classList.add('showdown-winner-locked')"));
});

check('Live reduced motion performs no travelling-card animation',()=>{
  const present=production.slice(production.indexOf('async function presentShowdownRail'),production.indexOf('function showdownRailResultCopy'));
  const reduced=present.slice(present.indexOf('if (motionOff())'),present.indexOf("await new Promise(resolve=>requestAnimationFrame(resolve))"));
  assert.ok(reduced.includes("entry.shell.classList.add('is-ready')"));
  assert.ok(reduced.includes("lane.classList.add('is-settled','is-stamped')"));
  assert.ok(!reduced.includes('.animate('));
  assert.ok(!reduced.includes('staggerMs'));
});

check('Live cleanup cancels animations, restores sources and removes the lane',()=>{
  const reset=production.slice(production.indexOf('function resetShowdownRailPresentation'),production.indexOf('function showdownRailSource'));
  assert.ok(reset.includes('showdownRailAnimations.forEach'));
  assert.ok(reset.includes('animation.cancel()'));
  assert.ok(reset.includes("el.style.visibility=''"));
  assert.ok(reset.includes('lane.remove()'));
  const clearCards=production.slice(production.indexOf('function clearAllCardDOM(){'),production.indexOf('async function muckCards'));
  assert.ok(clearCards.indexOf('cancelAllCardTurns()')<clearCards.indexOf('resetShowdownRailPresentation()'));
});

check('Live payout clears the rail before any chip or bankroll mutation',()=>{
  const sequence=production.slice(production.indexOf('async function runShowdownAwardSequence'),production.indexOf('await finishHand(outcome)'));
  const clear=sequence.indexOf('await clearShowdownRailPresentation()');
  const mutation=sequence.indexOf('w.chips += s.amount');
  assert.ok(clear!==-1 && mutation>clear);
});

check('Live rail CSS is a shallow five-card guide with continuous physical motion',()=>{
  const railCss=productionCss.slice(productionCss.indexOf('/* RAIL FIVE'),productionCss.indexOf('.card.win-card'));
  assert.ok(railCss.includes('grid-template-columns:repeat(5,44px)'));
  assert.ok(railCss.includes('grid-template-columns:repeat(5,42px)'));
  assert.ok(!/steps\s*\(/i.test(railCss));
  assert.ok(!/backdrop-filter\s*:/.test(railCss));
  assert.ok(!/\.showdown-(?:rail-(?:card|face)|card-shine)[^{]*\{[^}]*filter\s*:/s.test(railCss));
  assert.ok(!/winning five/i.test(railCss));
});

check('Live result uses the production CRT and keeps fold wins rail-free',()=>{
  assert.ok(production.includes("paintCRT($('hand-strength')"));
  assert.ok(production.includes("paintCRT($('banner')"));
  assert.ok(production.includes("if (main.cards){\n    const railReady=await presentShowdownRail(main)"));
});

check('The development harness can exercise the shipped rail without starting or saving a game',()=>{
  assert.ok(html.includes('id="sdr-live"'));
  assert.ok(labSource.includes('const ready=await presentShowdownRail(main)'));
  assert.ok(labSource.includes("$('sdr-live').onclick=replayLiveRail"));
  assert.ok(labSource.includes('player._handRes=evaluate7WithCards'));
});

check('Rail Five remains shipped after the later build/cache marker advance',()=>{
  assert.ok(support.includes("const BUILD_VERSION = 'v0.32.4-dev · Winning Hand Stamp'"));
  assert.ok(serviceWorker.includes("const CACHE_NAME = 'poker-v32-4'"));
  assert.ok(production.includes('function presentShowdownRail(main)'));
});

process.stdout.write('\n'+passed+' focused Showdown Rail checks passed.\n');
