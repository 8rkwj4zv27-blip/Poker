#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const clean=url=>url.split('?')[0];
let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }
function load(file,extra={}){
  const context=Object.assign({console,Math,JSON},extra);
  context.window=context;
  vm.createContext(context);
  vm.runInContext(read(file),context,{filename:file});
  return context;
}
/* The Lab cast is no longer the Lab's own: js/chatter/01-residents.js is
   an adapter over the production registry, so the registry has to be in
   the context first — exactly as chatter-stage.html loads it. */
function loadWithResidents(file,extra={}){
  const context=Object.assign({console,Math,JSON},extra);
  context.window=context;
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(read('js/03-residents.js'),context,{filename:'js/03-residents.js'});
  vm.runInContext(read(file),context,{filename:file});
  return context;
}

check('The Lab cast is exactly the five residents in the brief',()=>{
  const ctx=loadWithResidents('js/chatter/01-residents.js');
  const R=ctx.ChatterResidents;
  assert.strictEqual(R.all.map(r=>r.name).join(','),'Harry,Tony,Lucy,Nigel,Steve');
  R.all.forEach(r=>{
    assert.ok(r.rest&&r.moods,'resident needs resting and reaction art: '+r.name);
    ['smug','sly','pleased','rattled','cross'].forEach(m=>assert.ok(R.moodArt(r,m)));
  });
  // ...and it is the PRODUCTION cast, not a second copy of it.
  const production=ctx.TheResidents.all;
  assert.deepStrictEqual(R.all.map(r=>r.id),production.map(r=>r.id));
  assert.deepStrictEqual(R.all.map(r=>r.faceColorIdx),production.map(r=>r.faceColorIdx));
  R.all.forEach((r,i)=>{
    assert.strictEqual(r.rest,production[i].rest);
    assert.deepStrictEqual(r.moods,production[i].moods);
  });
});

check('The Lab declares no cast of its own — one canonical registry',()=>{
  const adapter=read('js/chatter/01-residents.js').replace(/\/\*[\s\S]*?\*\//g,'');
  // No literal identity may be authored here: a name, a colour index or a
  // biography in this file would be a second editable source of truth.
  ['Harry','Tony','Lucy','Nigel','Steve'].forEach(name=>{
    assert.ok(!adapter.includes("'"+name+"'"),'adapter must not author a name: '+name);
  });
  assert.ok(!/faceColorIdx\s*:\s*\d/.test(adapter),'adapter must not author a portrait colour');
  assert.ok(adapter.includes('TheResidents'),'adapter must read the production registry');
  // ...and it refuses to run without it rather than inventing an empty house.
  assert.throws(()=>load('js/chatter/01-residents.js'),/requires js\/03-residents\.js/);
});

check('The focused Lab contains only clean E1 and its paper-backed variation',()=>{
  const P=load('js/chatter/05-presenters.js',{document:{createElement:()=>({})}}).ChatterPresenters;
  const meta=P.meta();
  assert.strictEqual(meta.map(m=>m.key).join(','),'E1,E2');
  assert.strictEqual(meta.length,2);
  meta.forEach(m=>assert.ok(m.name));
});

check('Pixel chatter is a bounded repeated typing instrument, never faux language',()=>{
  const V=load('js/chatter/03-voice.js').ChatterVoice;
  const stage=read('js/chatter-stage.js');
  assert.strictEqual(typeof V.open,'function');
  assert.strictEqual(typeof V.tick,'function');
  assert.ok(V.durations.open<=20&&V.durations.tick<=20&&V.durations.final<=45);
  assert.strictEqual(typeof V.beginPhrase,'function');
  assert.ok(V.patterns>=3,'chatter needs several deliberate pitch cadences');
  const code=read('js/chatter/03-voice.js').replace(/\/\*[\s\S]*?\*\//g,'');
  [/speechSynthesis/,/formant/i,/vowel/i,/syllable/i,/vibrato/i,/warbl/i,/\.mp3|\.wav|\.ogg/].forEach(pattern=>{
    assert.ok(!pattern.test(code),'voice-like or recorded-speech machinery found: '+pattern);
  });
  assert.ok(!V.PROFILES,'sound must not have per-character profiles');
  assert.ok(stage.includes("group=text.length<=20?2:3"),'typing must reveal in two- or three-character steps');
  assert.ok(stage.includes('sounding.forEach(function(index){ ticks[index]=true; })'),'every meaningful typing step should chatter');
  assert.ok(stage.includes('/[A-Za-z0-9]/.test'),'spaces and punctuation must not create chatter ticks');
  assert.ok(stage.includes('V.beginPhrase()')&&stage.includes('V.open()')&&stage.includes('V.tick({final:stepIndex===plan.lastSounding})'),'phrase start, bubble open, repeated ticks, and final bloop must all be scheduled');
});

check('Production never loads or caches the Lab',()=>{
  const index=read('index.html'),sw=read('sw.js');
  ['chatter-lab','chatter-stage','chatter-system','js/chatter/'].forEach(token=>{
    assert.ok(!index.includes(token),'index.html must not load '+token);
    assert.ok(!sw.includes(token),'sw.js must not cache '+token);
  });
});

check('The shell is simple and the stage loads no poker engine',()=>{
  const shell=read('chatter-lab.html');
  const shellScripts=(shell.match(/<script src="([^"]+)"/g)||[]).map(x=>clean(x.match(/src="([^"]+)/)[1]));
  const shellSheets=(shell.match(/<link rel="stylesheet" href="([^"]+)"/g)||[]).map(x=>clean(x.match(/href="([^"]+)/)[1]));
  assert.deepStrictEqual(shellScripts,['js/chatter-lab.js']);
  assert.deepStrictEqual(shellSheets,['css/chatter-lab.css']);
  assert.strictEqual((shell.match(/data-visual=/g)||[]).length,2);
  assert.strictEqual((shell.match(/data-sound=/g)||[]).length,2);
  assert.strictEqual((shell.match(/data-sample=/g)||[]).length,4);

  const stage=read('chatter-stage.html');
  const stageScripts=(stage.match(/<script src="([^"]+)"/g)||[]).map(x=>clean(x.match(/src="([^"]+)/)[1]));
  assert.deepStrictEqual(stageScripts,[
    'js/02-support-systems.js','js/03-residents.js','js/chatter/01-residents.js',
    'js/chatter/03-voice.js','js/chatter/05-presenters.js','js/chatter-stage.js'
  ]);
  ['01-poker-math','03-opponents','04-modes-and-scoring','05-game-engine','06-presentation','07-ui-wiring','08-dev-mode']
    .forEach(token=>assert.ok(!stage.includes(token),'stage must not load '+token));
});

check('The preview preserves the production phone composition',()=>{
  const stage=read('chatter-stage.html'),index=read('index.html');
  ['id="table-screen"','class="topbar"','id="arcade-score-machine"','id="felt"','id="pot-area"',
   'id="board"','class="dealer-station"','id="hud-frame"','id="hand-strength"','id="banner"',
   'id="jackpot"','id="action-area"','id="btn-fold"','id="btn-checkcall"','id="btn-raise"']
    .forEach(token=>{ assert.ok(stage.includes(token),'stage missing '+token); assert.ok(index.includes(token),'production missing '+token); });
  const sheets=(stage.match(/<link rel="stylesheet" href="([^"]+)"/g)||[]).map(x=>clean(x.match(/href="([^"]+)/)[1]));
  assert.deepStrictEqual(sheets.slice(0,6),[
    'css/01-foundation.css','css/02-screens.css','css/03-action-console.css',
    'css/04-overlays-and-modes.css','css/05-responsive-and-arcade.css','css/06-machine-system.css'
  ]);
});

check('The prototype cannot touch Career saves, game state, or hidden cards',()=>{
  ['js/chatter-lab.js','js/chatter-stage.js','js/chatter/01-residents.js','js/chatter/03-voice.js','js/chatter/05-presenters.js']
    .forEach(file=>{
      const src=read(file).replace(/\/\*[\s\S]*?\*\//g,'');
      ['localStorage','saveCareer','enterCareerEvent','holeCards','player.cards','evaluate(','bestHand'].forEach(token=>{
        assert.ok(!src.includes(token),file+' must not reach for '+token);
      });
    });
});

check('Chatter rejects overflow explicitly and avoids permanent table displacement',()=>{
  const css=read('css/chatter-system.css');
  const stage=read('js/chatter-stage.js'),presenters=read('js/chatter/05-presenters.js');
  assert.ok(!/text-overflow\s*:\s*ellipsis/.test(css),'bubble text must never silently ellipsize');
  assert.ok(!/border-radius\s*:\s*50%/.test(css),'speech bubbles must never become circular or oval');
  assert.ok(css.includes('.cht-elastic.dir-centre .cht-tail{ left:50%; transform:translateX(-50%); }'),'centre speakers need an explicit, unrotated tail position');
  assert.ok(stage.includes('showFailure')&&presenters.includes('verifyFit'),'overflow must surface as an authoring failure');
  assert.ok(!/\.felt[^\{]*\{[^\}]*padding-(top|bottom)/s.test(css),'chatter must not reserve permanent felt space');
  assert.ok(css.includes('.seat.cht-lane-seat{ transform:translateY(10px); }'),'local candidates should use only the tested 10px centre-seat settle');
});

process.stdout.write('\n'+passed+' chatter design-lab checks passed.\n');
