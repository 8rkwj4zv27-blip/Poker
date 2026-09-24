#!/usr/bin/env node
"use strict";

/* Pattern Book checks: the signed-off parts stay the one shared finish.
   Run: node validation/pattern-book-checks.js
   Families move into the book one at a time; add their checks here as they
   land (see docs/ui/PATTERN_BOOK.md). */

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const indexHtml=read('index.html');
const serviceWorker=read('sw.js');
const crtCss=read('css/machine-crt.css');
const crtJs=read('js/machine-crt.js');
const book=read('pattern-book.html');
const productionJs=['js/05-game-engine.js','js/06-presentation.js','js/07-ui-wiring.js','js/career-hub-live.js','js/home-boot.js','js/table-intro.js'];

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }

// Every class attribute (HTML or a JS string template) in production markup.
// Read up to the attribute's closing double quote, so a class list built
// across a JS string join ('a'+(x?' b':'')+' c') is seen whole.
function classLists(){
  const out=[];
  const grab=(src,file)=>{ const re=/class=\\?"([^"]*)"/g; let m; while((m=re.exec(src))) out.push({file,raw:m[1],classes:m[1].match(/[A-Za-z0-9_-]+/g)||[]}); };
  grab(indexHtml,'index.html');
  productionJs.forEach(f=>grab(read(f),f));
  return out;
}
// Classes that mean "this is a CRT screen" in the older per-screen recipes.
const CRT_MARKERS=['crt-screen','pc-display','ch2-crt-glass'];

check('Every CRT screen in production markup carries .machine-crt',()=>{
  const crts=classLists().filter(c=>c.classes.some(k=>CRT_MARKERS.includes(k)));
  assert.ok(crts.length>=9,'expected at least 9 CRT screens, found '+crts.length);
  crts.forEach(c=>assert.ok(c.classes.includes('machine-crt'),c.file+': "'+c.raw+'" is a CRT without machine-crt'));
});

check('The CRT finish is loaded after every other stylesheet, and its script after every other script',()=>{
  const links=[...indexHtml.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1]);
  assert.ok(links[links.length-1].startsWith('css/machine-crt.css'),'machine-crt.css must be the last stylesheet, found '+links[links.length-1]);
  const scripts=[...indexHtml.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
  assert.ok(scripts[scripts.length-1].startsWith('js/machine-crt.js'),'machine-crt.js must be the last script');
});

check('The service worker precaches the CRT finish',()=>{
  assert.ok(serviceWorker.includes("'./css/machine-crt.css"),'sw.js is missing css/machine-crt.css');
  assert.ok(serviceWorker.includes("'./js/machine-crt.js"),'sw.js is missing js/machine-crt.js');
});

check('The CRT file owns glass, motion, blink, ink and Reduced Motion',()=>{
  ['#app .machine-crt::after','--crt-ink-info','--crt-ink-live','--crt-ink-money','--crt-ink-danger',
   '@keyframes crtFlickerLayer','@keyframes crtRefresh','#app .machine-crt.crt-refresh',
   '[data-motion="off"] #app .machine-crt','prefers-reduced-motion'].forEach(s=>assert.ok(crtCss.includes(s),'machine-crt.css is missing '+s));
});

check('CRT text takes its ink from the finish, declared by meaning',()=>{
  assert.ok(crtCss.includes('color:var(--crt-text) !important'),'the finish must own CRT text colour');
  [['hand-strength','live'],['banner','live'],['hud-invested','money'],['raise-amt','money']].forEach(([id,ink])=>{
    const tag=indexHtml.match(new RegExp('<[^>]*id="'+id+'"[^>]*>'));
    assert.ok(tag && tag[0].includes('data-ink="'+ink+'"'),id+' must declare data-ink="'+ink+'"');
  });
});

check('CRT glow is sized relative to the text, never in fixed pixels',()=>{
  const blooms=[...crtCss.matchAll(/--crt-bloom:([^;]+);/g)].map(m=>m[1]).filter(v=>v.trim()!=='none');
  assert.ok(blooms.length>=5,'expected the glow options');
  blooms.forEach(v=>assert.ok(!/\d(\.\d+)?px/.test(v),'glow must use em, not px: '+v));
});

check('Number-wheel CRTs opt out of the text blink; the blink respects Reduced Motion',()=>{
  ['hud-invested','raise-amt'].forEach(id=>{
    const tag=indexHtml.match(new RegExp('<[^>]*id="'+id+'"[^>]*>'));
    assert.ok(tag && tag[0].includes('data-crt-blink="off"'),id+' must set data-crt-blink="off"');
  });
  assert.ok(crtJs.includes("dataset.crtBlink === 'off'"));
  assert.ok(crtJs.includes('motionOff()'));
});

check('No other live stylesheet restyles CRT glass with a new recipe',()=>{
  // The older recipes may remain as layers underneath; a new rule that sets a
  // CRT background after the finish would be drift. Only machine-crt.css may
  // mention the machine-crt class.
  const live=[...indexHtml.matchAll(/<link rel="stylesheet" href="css\/([^"?]+)/g)].map(m=>'css/'+m[1]).filter(f=>f!=='css/machine-crt.css');
  live.forEach(f=>assert.ok(!read(f).includes('machine-crt'),f+' styles .machine-crt; put CRT finish changes in css/machine-crt.css'));
});

check('Every Finishes option has tokens behind it, and the menu can be switched off',()=>{
  const finishes=read('js/finishes.js');
  const css=read('css/machine-crt.css')+read('css/press-feel.css');
  assert.ok(/const FINISHES_MENU = (true|false);/.test(finishes),'FINISHES_MENU switch missing');
  const sets=[...finishes.matchAll(/attr:'(finish[A-Za-z]+)'[\s\S]*?\]\s*\}/g)];
  assert.ok(sets.length>=3,'expected at least 3 finish sets');
  sets.forEach(m=>{
    const attr=m[1].replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
    const ids=[...m[0].matchAll(/id:'([a-z-]*)'/g)].map(x=>x[1]);
    assert.strictEqual(ids[0],'',m[1]+': the first option must be the signed-off default (blank id)');
    ids.slice(1).filter(id=>!(m[1]==='finishPress' && id==='original')).forEach(id=>
      assert.ok(css.includes('[data-'+attr+'="'+id+'"]'),m[1]+' option "'+id+'" has no [data-'+attr+'] tokens'));
  });
  assert.ok(indexHtml.includes("localStorage.getItem('felt.finishes')"),'saved finishes must apply before first paint');
});

check('Production isolation audit: the Pattern Book page is never shipped or linked',()=>{
  assert.ok(!indexHtml.includes('pattern-book'),'index.html links the Pattern Book');
  assert.ok(!serviceWorker.includes('pattern-book'),'sw.js precaches the Pattern Book');
  assert.ok(book.includes('css/machine-crt.css') && book.includes('js/machine-crt.js'),'the book must run on the real CRT files');
});

process.stdout.write('\n'+passed+' Pattern Book checks passed.\n');
