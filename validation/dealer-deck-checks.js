#!/usr/bin/env node
"use strict";

/* Dealer deck checks (js/dealer-deck.js + css/dealer-deck.css, v0.45.0):
   the deck is presentation only. It ships the owner's order from the Deck
   Lab (round 4), touches the game's deck only in the flop (the same three
   cards in the same order as the shipped dealCommunity(3)), never for a
   burn, hands every wrapped function back to the shipped one when motion
   is off, and gives the player the card back and the side in Settings.
   Run: node validation/dealer-deck-checks.js */

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const indexHtml=read('index.html'), sw=read('sw.js'), support=read('js/02-support-systems.js');
const engine=read('js/05-game-engine.js');
const js=read('js/dealer-deck.js'), css=read('css/dealer-deck.css'), md=read('docs/ui/PATTERN_BOOK.md');

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }
// a function's body, by brace matching from its declaration
function fnBody(src,decl){
  const at=src.indexOf(decl); assert.ok(at>=0,'missing '+decl);
  let i=src.indexOf('{',at), d=0, j=i;
  do{ if(src[j]==='{')d++; else if(src[j]==='}')d--; j++; }while(d);
  return src.slice(at,j);
}
// an object literal's value, evaluated on its own
function literal(src,decl){
  const at=src.indexOf(decl); assert.ok(at>=0,'missing '+decl);
  const open=src.indexOf('{',at);
  let d=0, j=open;
  do{ if(src[j]==='{')d++; else if(src[j]==='}')d--; j++; }while(d);
  return JSON.parse(JSON.stringify(vm.runInNewContext('('+src.slice(open,j)+')')));
}
const BACKS=['crest','lattice','classic','velvet','midnight','emerald','check','sunburst','ivory','harlequin'];

check('Loaded by the game after the Showdown (and before the CRT component), precached offline',()=>{
  const links=[...indexHtml.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]);
  assert.ok(links.includes('css/dealer-deck.css') && links.indexOf('css/dealer-deck.css')<links.indexOf('css/crt.css'),'css/dealer-deck.css must load before css/crt.css');
  const scripts=[...indexHtml.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);
  assert.ok(scripts.includes('js/dealer-deck.js'),'index.html must load js/dealer-deck.js');
  // it wraps dealCommunity over the Showdown's wrapper, so it loads after it
  ['js/05-game-engine.js','js/06-presentation.js','js/coin-table.js','js/showdown.js'].forEach(f=>
    assert.ok(scripts.indexOf(f)>=0 && scripts.indexOf(f)<scripts.indexOf('js/dealer-deck.js'),'js/dealer-deck.js must load after '+f));
  [...indexHtml.matchAll(/(css\/dealer-deck\.css|js\/dealer-deck\.js)\?v=([^"]+)/g)].forEach(m=>assert.ok(sw.includes("'./"+m[1]+'?v='+m[2]+"'"),'sw.js must precache '+m[0]));
});

check('Build and offline cache markers are synchronised for the deck',()=>{
  const build=(support.match(/BUILD_VERSION\s*=\s*'v0\.(\d+)\.(\d+)/)||[]).slice(1), cache=(sw.match(/CACHE_NAME\s*=\s*'poker-v(\d+)-(\d+)'/)||[]).slice(1);
  assert.deepStrictEqual(build,cache,'BUILD_VERSION and CACHE_NAME must match');
  assert.ok(Number(build[0])>=45,'the dealer deck shipped in v0.45');
});

check('It ships the owner\'s order (Deck Lab, round 4)',()=>{
  const order=literal(js,'const DEFAULTS = {');
  assert.deepStrictEqual(order,{
    dealer:'new', where:'left', size:'std', back:'crest',
    shuffle:'full', when:'every', burn:'tuck',
    eject:'kick', recoil:'on', flight:'flick', pace:'today', land:'puff', yours:'land',
    flop:'spread', flopflip:'wave', beat:'beat',
    sweep:'scatter', sound:'mech'
  });
});

check('The flop takes the same three cards off the same deck, in the same order, as the shipped deal',()=>{
  const flop=fnBody(js,'async function flop(g){');
  assert.ok(/for \(let i = 0; i < 3; i\+\+\)\{ const c = g\.deck\.pop\(\); g\.board\.push\(c\); cards\.push\(c\); \}/.test(flop),'the flop must pop three cards onto the board, one at a time');
  assert.strictEqual((flop.match(/g\.deck\.pop\(\)/g)||[]).length,1,'the flop pops the deck in one place only');
  // the shipped deal it stands in for does the same
  const shipped=fnBody(engine,'async function dealCommunity(n){');
  assert.ok(/const card = g\.deck\.pop\(\);\s*g\.board\.push\(card\);/.test(shipped),'the shipped dealCommunity pops then pushes');
  // it stands in only for the flop; the turn and river go to the shipped chain
  const dc=fnBody(js,'async function dealCommunity2(n){');
  assert.ok(/if \(n === 3\) return flop\(g\);\s*return orig\.dealCommunity\.apply\(this, arguments\);/.test(dc),'only the flop is dealt by the deck itself');
});

check('Burns and the shuffle are drawn only: poker state is never touched outside the flop',()=>{
  const burn=fnBody(js,'async function burnOne(){');
  assert.ok(!/\.deck\b|board|chips|\.pot\b/.test(burn),'a burn must not touch the game\'s deck, board, chips or pot');
  const shuffle=fnBody(js,'async function handShuffle(kind){');
  assert.ok(!/game|g\.deck|\bshuffle\(/.test(shuffle),'the shuffle must not touch the game or its deck');
  // outside the flop, nothing in the file reaches the deck, the board, chips or the pot
  const rest=js.replace(fnBody(js,'async function flop(g){'),'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"\\])\/\/[^\n]*/g,'$1');
  assert.ok(!/g\.deck|game\.deck|\.deck\s*=|g\.board\.push|\.chips\s*[-+]?=|\.pot\s*[-+]?=/.test(rest),'only the flop may take cards from the deck');
});

check('Every wrapper hands back to the shipped function when motion is off',()=>{
  [['async function dealCardFlight2(','orig.dealCardFlight'],['async function dealCommunity2(','orig.dealCommunity'],['async function muckCards2(','orig.muckCards']].forEach(([decl,back])=>{
    const body=fnBody(js,decl);
    assert.ok(body.includes('if (!live() || !deck()) return '+back+'.apply(this, arguments);'),decl+' must hand back when motion is off');
  });
  assert.ok(/const live = \(\) => on\(\) && !motionOff\(\);/.test(js),'live() must respect Reduced Motion');
  const ps=fnBody(js,'async function playShuffle2(){');
  assert.ok(/if \(motionOff\(\) \|\| !due\)\{ setCount\(52\); return; \}/.test(ps),'no shuffle animation with motion off');
  const install=fnBody(js,'function install(){');
  ['dealCardFlight','dealCommunity','muckCards','playShuffle','keepPotClearOfDeck','clearAllCardDOM'].forEach(f=>assert.ok(install.includes('orig.'+f+' = '+f),'install() must keep the shipped '+f));
});

check('Settings → The deck: ten backs (plus the old green) and the side, saved with settings',()=>{
  const defaults=literal(support,'const DEFAULT_SETTINGS = {');
  assert.strictEqual(defaults.deckBack,'crest','the house crest is the default back');
  assert.strictEqual(defaults.deckSide,'left','the deck sits bottom left by default');
  const seg=(indexHtml.match(/id="deck-back-seg"[\s\S]*?<\/div>/)||[''])[0];
  const offered=[...seg.matchAll(/data-v="([a-z]+)" class="ds-swatch[^"]*" data-cb="([a-z]+)"/g)].map(m=>{ assert.strictEqual(m[1],m[2]); return m[1]; });
  assert.deepStrictEqual(offered,BACKS.concat('table'),'Settings must offer the ten backs and the old green, in order');
  assert.ok(/id="settings-deck"[\s\S]*?class="segmented compact" id="deck-back-seg"[\s\S]*?class="segmented compact" id="deck-side-seg"/.test(indexHtml),'Settings → The deck must use the sheet\'s segmented keys');
  BACKS.forEach(b=>assert.ok(css.includes('html[data-ds-back="'+b+'"],.ds-swatch[data-cb="'+b+'"]{'),'css/dealer-deck.css must draw the '+b+' back'));
  assert.ok(/const BACKS = \['crest','lattice','classic','velvet','midnight','emerald','check','sunburst','ivory','harlequin','table'\];/.test(js),'js/dealer-deck.js must know the same backs');
});

check('One back for every face-down card: the deck is the dealt card',()=>{
  // one recipe draws every face-down card; the deck's cards only step down
  assert.ok(css.includes('html[data-ds-on]:not([data-ds-back="table"]) .card.back,'),'every face-down card takes the chosen back');
  const deckRule=(css.match(/html\[data-ds-on\] #felt \.dealer-deck \.card\.back\{[^}]*\}/)||[''])[0];
  assert.ok(/inset 0 0 0 2px var\(--cb-trim/.test(deckRule),'the deck keeps the back\'s trim (the dealt cards have it too)');
});

check('The Lab stays a Lab',()=>{
  ['deck-lab','js/deck-lab.js','js/showdown-lab-host.js'].forEach(n=>{ assert.ok(!indexHtml.includes(n),'index.html links '+n); assert.ok(!sw.includes(n),'sw.js precaches '+n); });
  const lab=read('deck-lab.html');
  assert.ok(/"js":\["js\/deck-lab\.js"\]/.test(lab),'the Lab runs the live deck and only adds its controls');
});

check('The Pattern Book records the deck',()=>{
  assert.ok(md.includes('## Dealer deck (live v0.45.0)'),'docs/ui/PATTERN_BOOK.md must record the dealer deck');
});

process.stdout.write('\n'+passed+' Dealer deck checks passed.\n');
