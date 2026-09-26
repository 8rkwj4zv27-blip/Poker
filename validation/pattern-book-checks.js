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

check('Dashboard V2 frame, bays and rim light: live, shared, and to the rules',()=>{
  const css=read('css/dashboard.css'), js=read('js/dashboard.js'), consoleCss=read('css/03-action-console.css'), engine=read('js/05-game-engine.js');
  // The parts are shared classes on the real dashboard, not lab attributes.
  [['your-seat-dock','dash-frame'],['action-area','dash-frame-base'],['hud-left','dash-bay'],['hud-right','dash-bay']].forEach(([id,cls])=>{
    const tag=indexHtml.match(new RegExp('<[^>]*id="'+id+'"[^>]*>'));
    assert.ok(tag && new RegExp('class="[^"]*\\b'+cls+'\\b').test(tag[0]),'#'+id+' must carry .'+cls);
  });
  assert.ok(!/data-do-/.test(indexHtml) && !/data-do-/.test(css) && !/data-do-/.test(js),'production must not use the lab\'s data-do-* attributes');
  // Loaded by the game (before the CRT component, which stays last) and precached.
  const links=[...indexHtml.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]);
  assert.ok(links.includes('css/dashboard.css') && links.indexOf('css/dashboard.css')<links.indexOf('css/crt.css'),'index.html must load css/dashboard.css before css/crt.css');
  assert.ok(/<script src="js\/dashboard\.js/.test(indexHtml),'index.html must load js/dashboard.js');
  ["'./css/dashboard.css","'./js/dashboard.js"].forEach(f=>assert.ok(serviceWorker.includes(f),'sw.js is missing '+f));
  // The rim has exactly the four states, lit only by lamp colours or danger red.
  ['turn','allin','win','bust'].forEach(st=>assert.ok(css.includes('.dash-frame[data-rim="'+st+'"]'),'rim light state '+st+' missing'));
  const lamps=[...css.matchAll(/--dash-lamp:([^;]+);/g)].map(m=>m[1].trim());
  lamps.forEach(v=>assert.ok(['#2A2418','var(--pc-lamp-amber)','var(--pc-lamp-amber-hi)','var(--danger)'].includes(v),'the rim may only use lamp colours or danger red, found '+v));
  // The smooth frame is one piece: one shell on the dock runs down behind the key bay.
  assert.ok(/\.dash-frame::before\{[^}]*bottom:calc\(var\(--dash-drop\) \* -1\)/.test(css),'the frame must be one shell running down behind the key bay');
  assert.ok(!/\.actions-dock::(before|after)/.test(css),'the frame must not be drawn in two pieces');
  // V1's thin rim line is gone from the portrait game (landscape, which keeps
  // its own side-by-side layout, keeps it).
  const v1Rim=consoleCss.indexOf('#your-seat-dock::after'), landscape=consoleCss.lastIndexOf('@media (orientation:landscape){',v1Rim);
  assert.ok(v1Rim===-1 || (landscape!==-1 && !consoleCss.slice(landscape,v1Rim).includes('\n}\n')),'V1\'s thin rim may only remain for landscape');
  assert.ok(/@media \(orientation:landscape\)\{\s*#app #your-seat-dock\.dash-frame::before,#app #your-seat-dock\.dash-frame::after\{ display:none; \}/.test(css),'landscape must not draw the portrait frame');
  // The rim never sits over the cards: they stand in front of it, and nothing
  // transforms the case alone (the win shake moves the whole machine).
  const rimZ=+(css.match(/\.dash-frame::after\{[^}]*z-index:(\d+)/)||[])[1], cardZ=+(css.match(/\.seat\.you \.seat-cards\{[^}]*z-index:(\d+)/)||[])[1];
  assert.ok(rimZ && cardZ && cardZ>rimZ,'the cards must stand in front of the rim');
  assert.ok(css.includes('#hud-frame.hud-frame-win{ animation:none; }') && css.includes('.dash-frame.dash-shake{'),'the win shake must move the whole machine, never the case alone');
  assert.ok(!/#hud-frame[^{]*\{[^}]*transform/.test(css),'dashboard.css must not transform the case on its own');
  // Motion: stepped, with a relay click, and Reduced Motion honoured.
  assert.ok(/animation:dashRelay [^;]*steps\(/.test(css) && /animation:dashPulse [^;]*steps\(/.test(css) && /animation:dashFlickOut [^;]*steps\(/.test(css),'rim changes must switch in steps');
  assert.ok(css.includes('[data-motion="off"] #app .dash-frame') && css.includes('prefers-reduced-motion'),'the rim must honour Reduced Motion');
  assert.ok(js.includes('Sound.wheelRelay') && js.includes('motionOff()'),'the rim clicks with the machine relay and honours Reduced Motion');
  // Presentation only: the rim reads the table and never writes it.
  assert.ok(!/\b(game|pendingHumanPlayer)(\.[A-Za-z_]+)*\s*=[^=]/.test(js) && !/\b(applyAction|humanAct)\(/.test(js),'js/dashboard.js must never change game state');
  assert.ok(/if \(typeof DashRim !== 'undefined'\) DashRim\.win\(\);/.test(engine),'a win at your seat must light the rim');
  // The book shows the real part.
  assert.ok(book.includes('css/dashboard.css') && book.includes('class="dash-frame"'),'the Pattern Book must show the frame on the real css/dashboard.css');
});

check('Dashboard V2: the rest of the approved order is the lab default, and its parts keep to the rules',()=>{
  const lab=read('js/dashboard-order-lab.js'), css=read('css/dashboard-order.css'), js=read('js/dashboard-order.js');
  const order={ tray:'0', bet:'drum', bay:'cradle', raise:'barrel', sizing:'fader', knock:'on', peek:'hold', allin:'hold' };
  const def=lab.match(/const SUGGESTED = \{([\s\S]*?)\};/);
  assert.ok(def,'the order form must define its default order');
  Object.entries(order).forEach(([k,v])=>assert.ok(new RegExp('\\b'+k+":'"+v+"'").test(def[1]),'the default order must set '+k+' to '+v));
  // The frame, bays and rim are production parts now: the lab no longer draws its own.
  assert.ok(!/data-do-(build|recess|rim|light|lit)\b/.test(css+js+lab),'the lab must use the production frame, not its own');
  // Knock jolts the whole machine; a transform on the case alone lifts it under the rim light.
  assert.ok(!css.includes('.do-knocked #hud-frame'),'knock must not transform the case on its own');
  // The screen is a fixed size: its parts take fixed boxes, not their content's height.
  assert.ok(css.includes('.do-screen-top{ flex:0 0 var(--do-hand-h'),'the hand line must be a fixed box');
  // Lab only: never shipped with the game.
  ['dashboard-order'].forEach(n=>{ assert.ok(!indexHtml.includes(n),'index.html links '+n); assert.ok(!serviceWorker.includes(n),'sw.js precaches '+n); });
  assert.ok(js.includes("humanAct('check')") && js.includes('setWagerAmount('),'behaviours must act through the real game functions');
});

process.stdout.write('\n'+passed+' Pattern Book checks passed.\n');
