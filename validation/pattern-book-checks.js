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
  // The rim never sits over the cards: it is drawn UNDER the case (a
  // negative z-index), so the cards stay in front even while the case is
  // animated (any filter, transform or fade on the case flattens it and the
  // cards into one layer; a rim above the case then cut through the cards,
  // v0.43.0). Nothing transforms the case alone either (the win shake moves
  // the whole machine).
  const rimZ=+(css.match(/\.dash-frame::after\{[^}]*z-index:(-?\d+)/)||[])[1], cardZ=+(css.match(/\.seat\.you \.seat-cards\{[^}]*z-index:(\d+)/)||[])[1];
  assert.ok(rimZ<0 && cardZ>0,'the rim must be drawn under the case, the cards in front');
  assert.ok(/\.dash-frame\[data-rim\] #hud-frame\{[^}]*box-shadow:inset/.test(css),'the lit rim\'s glow onto the case must be redrawn on the case');
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

check('Enemy Cards V2: live, shared, presentation only, and to the order',()=>{
  const css=read('css/enemy-cards.css'), js=read('js/enemy-cards.js'), coin=read('js/coin-table.js'), pres=read('js/06-presentation.js'), opp=read('js/03-opponents.js');
  // Loaded by the game (before the CRT component, which stays last) and precached.
  const links=[...indexHtml.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]);
  assert.ok(links.includes('css/enemy-cards.css') && links.indexOf('css/enemy-cards.css')<links.indexOf('css/crt.css'),'index.html must load css/enemy-cards.css before css/crt.css');
  assert.ok(/<script src="js\/enemy-cards\.js/.test(indexHtml),'index.html must load js/enemy-cards.js');
  ["'./css/enemy-cards.css","'./js/enemy-cards.js"].forEach(f=>assert.ok(serviceWorker.includes(f),'sw.js is missing '+f));
  // Shared parts on the real seats, not the lab's attributes; the lab never ships.
  assert.ok(!/data-ec-/.test(css) && !/data-ec-/.test(js) && !/data-ec-/.test(indexHtml),'production must not use the lab\'s data-ec-* attributes');
  ['enemy-card-lab','js/enemy-card.js','css/enemy-card.css'].forEach(n=>{ assert.ok(!indexHtml.includes(n),'index.html links '+n); assert.ok(!serviceWorker.includes(n),'sw.js precaches '+n); });
  // The readout is the CRT component with its own ink.
  assert.ok(js.includes('class="crt ec-glass" data-crt-quiet') && js.includes('glass.dataset.ink'),'the readout must be a .crt using data-ink');
  // The rim: every state the order reacts to, lit only by their colour, lamp colours or danger red.
  ['turn','think','flash','next','win','allin','fold','out'].forEach(st=>assert.ok(css.includes('[data-rim="'+st+'"]'),'rim state '+st+' missing'));
  [...css.matchAll(/--ec-lamp:([^;]+);/g)].map(m=>m[1].trim()).forEach(v=>assert.ok(/--ec-own|--pc-lamp-amber-hi|--danger|#120f0c/.test(v),'the rim may only use their colour, lamp colours or danger red, found '+v));
  assert.ok(/animation:dashRelay [^;]*steps\(/.test(css) && /animation:dashPulse [^;]*steps\(/.test(css) && /animation:dashFlickOut [^;]*steps\(/.test(css),'rim changes must switch in steps, with the dashboard\'s keyframes');
  assert.ok(css.includes('[data-motion="off"]') && css.includes('prefers-reduced-motion') && js.includes('motionOff()'),'Enemy Cards must honour Reduced Motion');
  // Presentation only: it reads the table and never writes it.
  assert.ok(!/\b(game|pendingHumanPlayer)(\.[A-Za-z_]+)*\s*=[^=]/.test(js) && !/\b(applyAction|humanAct)\(/.test(js),'js/enemy-cards.js must never change game state');
  // Wired to the game: render paints, the coin table asks where coins go.
  assert.ok(pres.includes("if (typeof EnemyCards !== 'undefined') EnemyCards.paint();"),'render() must paint the enemy cards');
  ['EnemyCards.coinSource(p)','EnemyCards.spot(p, fr)','EnemyCards.rowKey(p)','EnemyCards.slot(p'].forEach(c=>assert.ok(coin.includes(c),'js/coin-table.js must ask '+c));
  // Every personality has a character name and keeps its style.
  const people=[...opp.matchAll(/\{key:'([a-z]+)',\s*name:'([A-Za-z]+)',\s*style:'([A-Za-z]+)'/g)];
  assert.strictEqual(people.length,8,'every personality needs a character name and a style');
  // The book shows the real part.
  assert.ok(book.includes('css/enemy-cards.css') && book.includes('class="seat ec-seat"'),'the Pattern Book must show the cards on the real css/enemy-cards.css');
});

check('Showdown lab: isolated, and its candidate never ships',()=>{
  // docs/ui/SHOWDOWN_PLAN.md: the order form and its candidate are Lab only.
  ['showdown-lab','js/showdown-beats.js','css/showdown-beats.css','js/showdown-lab-host.js'].forEach(n=>{ assert.ok(!indexHtml.includes(n),'index.html links '+n); assert.ok(!serviceWorker.includes(n),'sw.js precaches '+n); });
  const lab=read('js/showdown-lab.js'), hostJs=read('js/showdown-lab-host.js'), cand=read('js/showdown-beats.js'), bundle=read('validation/tools/lab-bundle.js');
  // The game copy runs on in-memory storage with no service worker, whether
  // the host builds it (local) or the bundler bakes it (a link).
  [hostJs,bundle].forEach(src=>assert.ok(src.includes('Storage.prototype') && src.includes('pwa-service-worker'),'the lab copy must run on in-memory storage with no service worker'));
  assert.ok(!/localStorage\.(setItem|removeItem|clear)/.test((lab+hostJs).replace(/`[\s\S]*?`/g,'')),'the lab itself must never write storage');
  // With every option at TODAY the candidate hands straight back to the shipped functions.
  assert.ok(/today\(\) \? orig\.handleShowdown/.test(cand) && /today\(\) \|\| !coinsOn\(\) \? orig\.award/.test(cand),'TODAY must run the shipped showdown and award');
  assert.ok(!/data-sd-/.test(indexHtml),'production must not use the lab\'s data-sd-* attributes');
});

check('Table room lab: isolated, and its TODAY is the shipped table',()=>{
  // docs/ui/TABLE_ROOM_PLAN.md: the crowding lab restyles the live table; it never ships.
  ['table-room-lab','js/table-room-lab.js','css/table-room-lab.css','js/table-room-lab-host.js'].forEach(n=>{ assert.ok(!indexHtml.includes(n),'index.html links '+n); assert.ok(!serviceWorker.includes(n),'sw.js precaches '+n); });
  const lab=read('js/table-room-lab.js'), hostJs=read('js/table-room-lab-host.js');
  assert.ok(hostJs.includes('Storage.prototype') && hostJs.includes('pwa-service-worker'),'the lab copy must run on in-memory storage with no service worker');
  assert.ok(!/localStorage\.(setItem|removeItem|clear)/.test((lab+hostJs).replace(/`[\s\S]*?`/g,'')),'the lab itself must never write storage');
  // HOLD: TODAY must be the game as it ships: nothing moved, nothing restyled.
  const today=lab.match(/const TODAY = \{([^}]*)\}/);
  assert.ok(today,'the lab needs its TODAY picks');
  ["pot:'0'","you:'sq'","pile:'spread'","their:'57'","lift:'0'","fade:'13'","mark:'square'","pods:'100'","coins:'15'"].forEach(k=>assert.ok(today[1].includes(k),'TODAY must keep '+k));
  // its sizes are measured against the shipped scale and pot place
  assert.ok(/\.felt \.seat:not\(\.you\)\{ scale:\.91;/.test(read('css/05-responsive-and-arcade.css')) && /const S0 = \.91;/.test(lab),'the lab\'s machine scale must match css/05');
  assert.ok(/const SIZES=\{ s:13, m:15, l:17 \};/.test(read('js/coin-world.js')) && /v === '15' \|\| !v \? 'm'/.test(lab),'the lab\'s TODAY chip size must be the shipped one (SIZES.m)');
  assert.ok(/#felt \.pot-area\{ top:77\.5%; \}/.test(read('css/05-responsive-and-arcade.css')) && lab.includes('top:calc(77.5% + '),'the lab\'s pot move must start from the shipped place');
});

check('Showdown: live, on the shared parts, and to the order',()=>{
  const css=read('css/showdown.css'), js=read('js/showdown.js'), md=read('docs/ui/PATTERN_BOOK.md');
  const links=[...indexHtml.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]);
  assert.ok(links.includes('css/showdown.css') && links.indexOf('css/showdown.css')<links.indexOf('css/crt.css'),'index.html must load css/showdown.css before css/crt.css');
  assert.ok(/<script src="js\/showdown\.js/.test(indexHtml),'index.html must load js/showdown.js');
  ["'./css/showdown.css","'./js/showdown.js"].forEach(f=>assert.ok(serviceWorker.includes(f),'sw.js is missing '+f));
  // No new finish: the meter is the CRT, the pot plates are the pot plate, the settings are the sheet's parts.
  assert.ok(js.includes("'sd-meter crt'") && js.includes('class="crt-caption"') && !/\.sd-meter(-keys)?\{[^}]*(color|background|font|text-shadow)/.test(css),'the win-chance meter must be the CRT component, laid out only');
  assert.ok(js.includes("'sd-potplate pot-chip'"),'the side-pot plates must be the pot plate');
  assert.ok(/id="settings-showdown"[\s\S]*?class="segmented compact/.test(indexHtml) && /id="sw-sd-winchance" role="switch"/.test(indexHtml),'Settings → Showdown must use the sheet\'s segmented keys and switch');
  // No flashing casino lights (the owner struck them): the lit face never chases.
  assert.ok(!/sdChase|sd-chaser|jackpot/i.test(css),'no chasing or jackpot lights on the Showdown');
  assert.ok(md.includes('## Showdown (live v0.42.0)'),'the Pattern Book must record the Showdown');
});

check('Dealer deck: live, on the shared parts, and to the order',()=>{
  const css=read('css/dealer-deck.css'), md=read('docs/ui/PATTERN_BOOK.md');
  const links=[...indexHtml.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]);
  assert.ok(links.includes('css/dealer-deck.css') && links.indexOf('css/dealer-deck.css')<links.indexOf('css/crt.css'),'index.html must load css/dealer-deck.css before css/crt.css');
  assert.ok(/<script src="js\/dealer-deck\.js/.test(indexHtml),'index.html must load js/dealer-deck.js');
  ["'./css/dealer-deck.css","'./js/dealer-deck.js"].forEach(f=>assert.ok(serviceWorker.includes(f),'sw.js is missing '+f));
  // No new finish for the settings: the sheet's segmented keys, laid out as a grid.
  assert.ok(/id="settings-deck"[\s\S]*?class="segmented compact" id="deck-back-seg"/.test(indexHtml),'Settings → The deck must use the sheet\'s segmented keys');
  // One card-back recipe: every back sets tokens only, never its own box.
  const backs=[...css.matchAll(/html\[data-ds-back="([a-z]+)"\],\.ds-swatch\[data-cb="[a-z]+"\]\{([^}]*)\}/g)];
  assert.strictEqual(backs.length,10,'ten card backs');
  backs.forEach(m=>assert.ok(!/(^|;|\s)(background|border|box-shadow)\s*:/.test(m[2]),'the '+m[1]+' back must set the recipe\'s tokens only'));
  assert.ok(md.includes('## Dealer deck (live v0.45.0)'),'the Pattern Book must record the dealer deck');
});

check('Action drum + knock to check: live, never ghosting, and to the order',()=>{
  const css=read('css/action-drum.css'), js=read('js/action-drum.js'), kcss=read('css/knock-check.css'), kjs=read('js/knock-check.js'), md=read('docs/ui/PATTERN_BOOK.md');
  const links=[...indexHtml.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]);
  ['css/action-drum.css','css/knock-check.css'].forEach(f=>assert.ok(links.includes(f) && links.indexOf(f)<links.indexOf('css/crt.css'),'index.html must load '+f+' before css/crt.css'));
  ['js/action-drum.js','js/knock-check.js'].forEach(f=>assert.ok(new RegExp('<script src="'+f.replace('.','\\.')).test(indexHtml),'index.html must load '+f));
  ["'./css/action-drum.css","'./css/knock-check.css","'./js/action-drum.js","'./js/knock-check.js"].forEach(f=>assert.ok(serviceWorker.includes(f),'sw.js is missing '+f));
  // The ghost: no side may be hidden by backface-visibility or preserve-3d.
  const code=src=>src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
  assert.ok(!/backface-visibility:hidden|preserve-3d/.test(code(css)) && !/backface|preserve-3d/.test(code(js)),'the drum must never lean on backface-visibility or preserve-3d');
  assert.ok(/el\.style\.visibility = live \? 'visible' : 'hidden'/.test(js) && /el\.style\.transform = live \? 'none'/.test(js),'at rest every side but the live one is hidden, and the live one has no transform');
  // The owner's order is the default, and it installs itself.
  const def=js.match(/const DEFAULTS = \{([^}]*)\}/);
  assert.ok(def,'the drum must define its defaults');
  Object.entries({ style:'drum', speed:'med', settle:'clunk', motion:'stepped', dir:'down', shade:'on', lip:'turn', slats:'turn', sound:'ticks' })
    .forEach(([k,v])=>assert.ok(new RegExp('\\b'+k+":'"+v+"'").test(def[1]),'the order sets '+k+' to '+v));
  assert.ok(/else install\(\);\s*\}\)\(\);\s*$/.test(js),'the drum must install itself at load');
  assert.ok(js.includes('motionOff()'),'Reduced Motion swaps at once');
  // NEXT HAND, REBUY and NEW TABLE are a side of the drum, in the console's key (v0.48.1).
  assert.ok(/const DEAL_KEYS = \['btn-rebuy', 'btn-new-table', 'btn-next-hand'\]/.test(js) && js.includes("b.classList.add('btn-award-console', 'ad-deal-key')"),'the deal keys must be moved onto the drum in the console\'s key');
  assert.ok(/if \(dealt\(\)\) return 'deal';/.test(js),'the drum must turn to the deal side whenever a deal key shows');
  assert.ok(css.includes('.ad-face-deal .btn-award-console{') && /position:static/.test(css),'the deal keys must sit on the drum, not float over the bay');
  // Every side's keys on the one key line.
  assert.ok(js.includes("'--ad-key-top'") && css.includes('margin-top:var(--ad-key-top'),'every side\'s keys take the row\'s measured line');
  // Presentation only: the drum never touches game state; the knock only ever checks.
  assert.ok(!/\b(game|pendingHumanPlayer)(\.[A-Za-z_]+)*\s*=[^=]/.test(js) && !/\b(applyAction|humanAct)\(/.test(js),'js/action-drum.js must never change game state');
  assert.ok(!/\b(game|pendingHumanPlayer)(\.[A-Za-z_]+)*\s*=[^=]/.test(kjs) && [...kjs.matchAll(/humanAct\(([^)]*)\)/g)].every(m=>m[1]==="'check'"),'the knock may only ever check');
  // Knock jolts the whole machine, never the case alone; Reduced Motion stills it.
  assert.ok(kcss.includes('#your-seat-dock.kc-jolt,#action-area.kc-jolt') && !/#hud-frame\.kc-jolt/.test(kcss),'the knock jolts the whole machine');
  assert.ok(kcss.includes('[data-motion="off"]'),'the knock honours Reduced Motion');
  // The lab tunes the live part; it never ships.
  const lab=read('action-drum-lab.html');
  assert.ok(!/js\/action-drum\.js|js\/knock-check\.js/.test((lab.match(/id="lab-inject">([^<]*)/)||[])[1]||''),'the lab must not inject a second drum or knock into a game that already has them');
  ['action-drum-lab','js/action-drum-lab.js'].forEach(n=>{ assert.ok(!indexHtml.includes(n),'index.html links '+n); assert.ok(!serviceWorker.includes(n),'sw.js precaches '+n); });
  assert.ok(md.includes('## Action drum (live v0.48.0)'),'the Pattern Book must record the action drum');
});

check('Award key: live, to the order, presentation only',()=>{
  const css=read('css/award-key.css'), js=read('js/award-key.js'), lab=read('action-drum-lab.html');
  const links=[...indexHtml.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]);
  assert.ok(links.includes('css/award-key.css') && links.indexOf('css/award-key.css')<links.indexOf('css/crt.css'),'index.html must load css/award-key.css before css/crt.css');
  assert.ok(indexHtml.indexOf('js/award-key.js')>indexHtml.indexOf('js/06-presentation.js') && indexHtml.indexOf('js/award-key.js')>indexHtml.indexOf('js/showdown.js'),'the award key must load after the functions it wraps');
  ["'./css/award-key.css","'./js/award-key.js"].forEach(f=>assert.ok(serviceWorker.includes(f),'sw.js is missing '+f));
  const def=js.match(/const DEFAULTS = \{([^}]*)\}/);
  assert.ok(def,'the award key must define its defaults');
  Object.entries({ finish:'velvet', words:'collect', amount:'printed', arrive:'glint', press:'sparks', theirs:'quiet', tiers:'on' })
    .forEach(([k,v])=>assert.ok(new RegExp('\\b'+k+":'"+v+"'").test(def[1]),'the order sets '+k+' to '+v));
  // The shared key, in a state; the game's words kept for screen readers.
  assert.ok(css.includes('.btn-award-console[data-ak="mine"]') && css.includes('.btn-award-console[data-ak="theirs"]'),'the win is a state of the shared AWARD key');
  assert.ok(js.includes("btn.setAttribute('aria-label', label)"),'the key keeps the game\'s own words as its label');
  // No chasing or jackpot lights (struck from the Showdown); Reduced Motion stills it.
  assert.ok(!/chase|jackpot/i.test(css),'no chasing or jackpot lights on the award key');
  assert.ok(css.includes('[data-motion="off"]') && css.includes('prefers-reduced-motion') && js.includes('motionOff()'),'the award key honours Reduced Motion');
  // Presentation only.
  assert.ok(!/\b(game|pendingHumanPlayer)(\.[A-Za-z_]+)*\s*=[^=]/.test(js) && !/\b(applyAction|humanAct)\(/.test(js),'js/award-key.js must never change game state');
  // The lab tunes the live part and never injects a second one.
  assert.ok(!/award-key/.test((lab.match(/id="lab-inject">([^<]*)/)||[])[1]||''),'the lab must not inject a second award key');
});

check('Card holder: live, on the shared parts, and to the order',()=>{
  const css=read('css/card-holder.css'), js=read('js/card-holder.js'), md=read('docs/ui/PATTERN_BOOK.md');
  assert.ok(/<link rel="stylesheet" href="css\/card-holder\.css/.test(indexHtml),'index.html must load css/card-holder.css');
  assert.ok(/<script src="js\/card-holder\.js/.test(indexHtml),'index.html must load js/card-holder.js');
  ["'./css/card-holder.css","'./js/card-holder.js"].forEach(f=>assert.ok(serviceWorker.includes(f),'sw.js is missing '+f));
  // No new finish for the setting: the sheet's segmented keys.
  assert.ok(/id="settings-deck"[\s\S]*?class="segmented compact" id="holder-seg"/.test(indexHtml),'Settings → The deck → Card holder must use the sheet\'s segmented keys');
  // The order: 10px of air, brass by default, the brass from the instrument gold.
  assert.ok(/const GAP = 10;/.test(js),'the holder sits 10px clear of the screen');
  assert.ok(/cardHolder:'brass'/.test(read('js/02-support-systems.js')),'brass is the default holder');
  assert.ok(/html\[data-holder="brass"\][^{]*::after\{[^}]*var\(--pc-lamp-amber/.test(css),'the brass lip uses the instrument gold');
  // A card mid-turn and a back keep their own box.
  const rules=[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^}]*)\}/g)];
  rules.filter(m=>/\.card\b/.test(m[1]) && /(background|box-shadow)\s*:/.test(m[2]))
    .forEach(m=>assert.ok(m[1].includes(':not(.back):not(.card-turning)'),'only faces at rest are dressed: '+m[1].trim()));
  assert.ok(md.includes('## Card holder (live v0.49.0)'),'the Pattern Book must record the card holder');
});

check('Deal styles + the 2.5D card: live, on the shared parts, and to the order',()=>{
  const js=read('js/deal-styles.js'), deck=read('js/dealer-deck.js'), md=read('docs/ui/PATTERN_BOOK.md');
  assert.ok(/<link rel="stylesheet" href="css\/deal-styles\.css/.test(indexHtml),'index.html must load css/deal-styles.css');
  assert.ok(/<script src="js\/dealer-deck\.js[^"]*"><\/script>\s*<script src="js\/deal-styles\.js/.test(indexHtml),'js/deal-styles.js loads right after js/dealer-deck.js');
  ["'./css/deal-styles.css","'./js/deal-styles.js"].forEach(f=>assert.ok(serviceWorker.includes(f),'sw.js is missing '+f));
  // No new finish for the setting: the sheet's switches and segmented keys.
  assert.ok(/id="settings-dealing"[\s\S]*?class="segmented compact" id="deal-quick-seg"[\s\S]*?class="segmented compact" id="deal-scope-seg"[\s\S]*?id="deal-style-list"/.test(indexHtml),'Settings → Dealing must use the sheet\'s segmented keys');
  assert.ok(js.includes('class="switch" role="switch"') && js.includes('segmented compact dst-rarity'),'each style row uses the sheet\'s switch and segmented keys');
  // The order: FLICK alone by default; the rarity chances; the 2.5D card on.
  assert.ok(/O\.on\[s\.id\] = s\.id === 'flick'/.test(js),'FLICK alone is on by default');
  assert.ok(/CHANCE = \{ rare:1 \/ 500, epic:1 \/ 800, legendary:1 \/ 3000 \}/.test(js),'rare, epic and legendary chances as ordered');
  assert.ok(/sprite:'on'/.test(deck),'the deck deals the 2.5D card');
  // The 2.5D card never tips far enough to show its thickness.
  assert.ok(/Math\.abs\(pitch\) \* \.22/.test(deck) && /Math\.abs\(bank\) \* \.5\b/.test(deck),'the pose stays gentle');
  // Presentation only.
  assert.ok(!/\b(game|pendingHumanPlayer)(\.[A-Za-z_]+)*\s*=[^=]/.test(js) && !/\b(applyAction|humanAct)\(/.test(js),'js/deal-styles.js must never change game state');
  assert.ok(md.includes('## Deal styles + the 2.5D card (live v0.51.0)'),'the Pattern Book must record the deal styles');
});

process.stdout.write('\n'+passed+' Pattern Book checks passed.\n');
