#!/usr/bin/env node
"use strict";

/* Pattern Book checks: the signed-off parts stay the one shared finish.
   Run: node validation/pattern-book-checks.js
   The rendered-style twin of these is validation/tools/crt-consistency.js
   (browser), which compares every CRT part as actually drawn.
   Families move into the book one at a time; add their checks here as they
   land (see docs/ui/PATTERN_BOOK.md). */

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const exists=f=>fs.existsSync(path.join(root,f));
const indexHtml=read('index.html');
const serviceWorker=read('sw.js');
const crtCss=read('css/crt.css');
const crtJs=read('js/crt.js');
const book=read('pattern-book.html');
const productionJs=['js/05-game-engine.js','js/06-presentation.js','js/07-ui-wiring.js','js/career-hub-live.js','js/home-boot.js','js/table-intro.js'];
const liveCss=[...indexHtml.matchAll(/<link rel="stylesheet" href="(css\/[^"?]+)/g)].map(m=>m[1]);

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
// The screens that are CRTs, by their own names.
const CRT_SCREENS=['crt-screen','pc-display','ch2-crt-glass','stage-score-hero','stage-instrument','stage-results-recap','stage-trophy','stage-run-progress','stats-card','pc-ready-readout','ch2-slot-readout'];

// A small CSS reader: every style rule with its selectors and declarations.
function cssRules(src){
  const clean=src.replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' '));
  const out=[]; let i=0, selStart=0;
  while(i<clean.length){
    const c=clean[i];
    if(c==='{'){
      const sel=clean.slice(selStart,i).trim();
      if(/^@(media|supports)/.test(sel)){ selStart=i+1; i++; continue; }
      if(sel.startsWith('@')){ let d=1,j=i+1; while(d){ if(clean[j]==='{')d++; else if(clean[j]==='}')d--; j++; } i=j; selStart=i; continue; }
      const end=clean.indexOf('}',i);
      out.push({ line:clean.slice(0,selStart).split('\n').length, selectors:sel.split(/,(?![^(]*\))/).map(s=>s.trim().replace(/\s+/g,' ')), decls:clean.slice(i+1,end) });
      i=end+1; selStart=i; continue;
    }
    if(c==='}') selStart=i+1;
    i++;
  }
  return out;
}
const CRT_SEL=/crt-screen|#banner\b|#hud-mid \.banner\b|^\.banner\b|hand-strength|crt-hand|crt-action|crt-line|crt-refresh|crt-cursor|\.stats-card|ch2-crt|pc-ready-readout|ch2-slot-readout|stage-instrument|stage-recap|stage-results-recap|stage-trophy|stage-run-progress|stage-score-hero|stage-score-readout|stage-score-carry|stage-ko-readout|stage-big-readout|stage-statement|\.stage-results \.amt-readout|hud-invested|raise-amt|pc-display|\.crt\b/;
const STATE=/hb-boot|career-entry-poweroff|dormant|event-complete|data-motion|wake-|career-result-panel \.stage-results-head/;
const OWN_PART=/(\.card\b|\.pc-lamp|\.r\b|\.s\b|\.pip\b)[^ ]*$/;
const REEL=/(jp-cell|jp-sym|jp-digit|reel-strip|mini-jackpot|stage-score-readout|amt-readout)\S*$/;
const FINISH=/^(background(-[a-z]+)?|border(-(top|right|bottom|left))?(-(color|style|width))?|border-radius|box-shadow|color|text-shadow|font(-[a-z]+)?|letter-spacing|text-transform|line-height|animation(-[a-z]+)?|isolation|--crt-[a-z-]+)$/;

check('Every CRT screen in production markup is built on the .crt component',()=>{
  const crts=classLists().filter(c=>c.classes.some(k=>CRT_SCREENS.includes(k)));
  assert.ok(crts.length>=15,'expected at least 15 CRT screens, found '+crts.length);
  crts.forEach(c=>assert.ok(c.classes.includes('crt'),c.file+': "'+c.raw+'" is a CRT without .crt'));
  assert.ok(!classLists().some(c=>c.classes.includes('machine-crt')),'the old machine-crt class is gone');
});

check('Nothing outside css/crt.css styles a CRT\'s glass or text',()=>{
  const leaks=[];
  liveCss.filter(f=>f!=='css/crt.css').forEach(f=>{
    cssRules(read(f)).forEach(rule=>{
      rule.selectors.filter(s=>CRT_SEL.test(s) && !STATE.test(s) && !OWN_PART.test(s)).forEach(s=>{
        rule.decls.split(/;(?![^(]*\))/).forEach(d=>{
          const prop=d.split(':')[0].trim().toLowerCase(); if(!prop) return;
          const bad=REEL.test(s) ? /^(color|text-shadow)$/.test(prop) : FINISH.test(prop);
          if(bad) leaks.push(f+':'+rule.line+'  '+s+' { '+prop+' }');
        });
      });
    });
  });
  assert.deepStrictEqual(leaks,[],'CRT finish/text set outside css/crt.css:\n  '+leaks.join('\n  '));
});

check('The component loads last and its engine before the Finishes menu',()=>{
  const links=[...indexHtml.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1]);
  assert.ok(links[links.length-1].startsWith('css/crt.css'),'crt.css must be the last stylesheet, found '+links[links.length-1]);
  const scripts=[...indexHtml.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
  assert.ok(scripts.indexOf('js/crt.js')>=0 && scripts.indexOf('js/crt.js')<scripts.indexOf('js/finishes.js'),'js/crt.js must load before js/finishes.js');
  assert.ok(!exists('css/machine-crt.css') && !exists('js/machine-crt.js'),'the old machine-crt files are removed');
});

check('The service worker precaches the component and never the old files',()=>{
  ["'./css/crt.css","'./js/crt.js"].forEach(f=>assert.ok(serviceWorker.includes(f),'sw.js is missing '+f));
  assert.ok(!serviceWorker.includes('machine-crt'),'sw.js still lists machine-crt');
});

check('Opening a Lab page never replaces the offline copy of the game',()=>{
  assert.ok(/const isGame = /.test(serviceWorker) && serviceWorker.includes("if (isGame && response && response.ok)"),'sw.js must only cache the game page as ./index.html');
});

check('The signed-off CRT recipe sets every dial on <html>, with values the component knows',()=>{
  const html=indexHtml.match(/<html[^>]*>/)[0];
  const dials={tint:['blue','dark','green','amber','black'],glow:'01234',scan:'01234',rgb:'01234',grain:'01234',curve:'01234',flicker:'01234',roll:'01234',tear:'01234',ghost:'01234',change:['burst','roll','channel','wipe','type'],ink:['meaning','one','mono']};
  Object.entries(dials).forEach(([k,allowed])=>{
    const m=html.match(new RegExp('data-crt-'+k+'="([^"]+)"'));
    assert.ok(m,'<html> is missing data-crt-'+k);
    assert.ok((Array.isArray(allowed)?allowed:allowed.split('')).includes(m[1]),'data-crt-'+k+'="'+m[1]+'" is not a known value');
    if(!['change','ghost'].includes(k)) assert.ok(m[1]==='blue'||m[1]==='0'||m[1]==='meaning'||crtCss.includes('[data-crt-'+k+'="'+m[1]+'"]'),'no tokens for data-crt-'+k+'="'+m[1]+'"');
  });
});

check('The component owns glass, text roles, ink, motion and Reduced Motion',()=>{
  ['.crt{','.crt .crt-line','.crt .crt-figure','.crt .crt-caption','.crt .crt-cell + .crt-cell','--crt-ink-info','--crt-ink-live','--crt-ink-money','--crt-ink-danger',
   '.crt[data-ink="live"]','@keyframes crtFlicker','@keyframes crtChannel','[data-motion="off"] .crt','prefers-reduced-motion'].forEach(s=>assert.ok(crtCss.includes(s),'crt.css is missing '+s));
  [['hand-strength','live'],['banner','live'],['hud-invested','money'],['raise-amt','money']].forEach(([id,ink])=>{
    const tag=indexHtml.match(new RegExp('<[^>]*id="'+id+'"[^>]*>'));
    assert.ok(tag && tag[0].includes('data-ink="'+ink+'"'),id+' must declare data-ink="'+ink+'"');
  });
});

check('CRT glow is sized relative to the text, never in fixed pixels',()=>{
  const blooms=[...crtCss.matchAll(/--crt-bloom:([^;]+);/g)].map(m=>m[1]).filter(v=>!/^0 0 0 transparent$/.test(v.trim()));
  assert.ok(blooms.length>=4,'expected the glow levels');
  blooms.forEach(v=>assert.ok(!/\d(\.\d+)?px/.test(v),'glow must use em, not px: '+v));
});

check('Number-wheel CRTs are quiet; the engine respects Reduced Motion and first text',()=>{
  ['hud-invested','raise-amt'].forEach(id=>{
    const tag=indexHtml.match(new RegExp('<[^>]*id="'+id+'"[^>]*>'));
    assert.ok(tag && tag[0].includes('data-crt-quiet'),id+' must set data-crt-quiet');
  });
  assert.ok(crtJs.includes("hasAttribute('data-crt-quiet')"));
  assert.ok(crtJs.includes('motionOff()'));
  assert.ok(crtJs.includes('first text, not a change'));
});

check('Every Finishes option has tokens or a preset behind it, and the menu can be switched off',()=>{
  const finishes=read('js/finishes.js');
  const press=read('css/press-feel.css');
  assert.ok(/const FINISHES_MENU = (true|false);/.test(finishes),'FINISHES_MENU switch missing');
  const presets=[...crtJs.matchAll(/\{ id:'([a-z]+)',\s+name:/g)].map(m=>m[1]);
  const sets=[...finishes.matchAll(/attr:'(finish[A-Za-z]+)'[\s\S]*?\]\s*\}/g)];
  assert.ok(sets.length>=2,'expected the CRT look and press sets');
  sets.forEach(m=>{
    const ids=[...m[0].matchAll(/id:'([a-z-]*)'/g)].map(x=>x[1]);
    assert.strictEqual(ids[0],'',m[1]+': the first option must be the signed-off default (blank id)');
    ids.slice(1).forEach(id=>{
      if(m[1]==='finishCrt') assert.ok(presets.includes(id),'CRT look "'+id+'" is not a CRT.PRESETS preset');
      else if(!(m[1]==='finishPress' && id==='original')) assert.ok(press.includes('[data-finish-press="'+id+'"]'),'press option "'+id+'" has no tokens');
    });
  });
  assert.ok(indexHtml.includes("localStorage.getItem('felt.finishes')") && indexHtml.includes('window.CRT_RECIPE'),'saved finishes must apply before first paint, keeping the recipe');
});

check('Production isolation audit: the Pattern Book and CRT Lab are never shipped or linked',()=>{
  assert.ok(!indexHtml.includes('pattern-book') && !serviceWorker.includes('pattern-book'),'the Pattern Book must never ship');
  assert.ok(!indexHtml.includes('crt-lab') && !serviceWorker.includes('crt-lab'),'the CRT Lab must never ship with the game');
  assert.ok(book.includes('css/crt.css') && book.includes('js/crt.js'),'the book must run on the real CRT files');
});

process.stdout.write('\n'+passed+' Pattern Book checks passed.\n');
