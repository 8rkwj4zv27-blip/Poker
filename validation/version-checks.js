#!/usr/bin/env node
"use strict";

/* Version checks. A release carries its version in three places, all
   bumped by hand: BUILD_VERSION (js/02-support-systems.js, shown in the
   main menu's footer), CACHE_NAME (sw.js, which makes installed phones
   fetch the new files) and the newest entry in CHANGELOG.md. If
   CACHE_NAME is forgotten, players keep the old game. If the CHANGELOG
   is forgotten, the record is wrong. This suite fails the moment the
   three disagree.
   Run: node validation/version-checks.js */

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }

let build, cache, logged;

check('BUILD_VERSION reads vMAJOR.MINOR.PATCH',()=>{
  const m=/const BUILD_VERSION = '(v(\d+)\.(\d+)\.(\d+))[^']*';/.exec(read('js/02-support-systems.js'));
  assert(m,'BUILD_VERSION not found in js/02-support-systems.js');
  build=m[1];
});

check('CACHE_NAME reads poker-vMINOR-PATCH',()=>{
  const m=/const CACHE_NAME = 'poker-v(\d+)-(\d+)';/.exec(read('sw.js'));
  assert(m,'CACHE_NAME not found in sw.js');
  cache='v0.'+m[1]+'.'+m[2];
});

check('CHANGELOG.md has a newest release entry',()=>{
  // the first "- **vX.Y.Z**" line under a "## v" heading (the Unreleased
  // section above them holds no version)
  const log=read('CHANGELOG.md');
  const first=log.indexOf('\n## v');
  assert(first>=0,'no "## v" release heading in CHANGELOG.md');
  const m=/^- \*\*(v\d+\.\d+\.\d+)\*\*/m.exec(log.slice(first));
  assert(m,'no "- **vX.Y.Z**" entry under the first release heading');
  logged=m[1];
});

check('CACHE_NAME matches BUILD_VERSION',()=>{
  assert.strictEqual(cache,build,'sw.js CACHE_NAME is '+cache+' but BUILD_VERSION is '+build+': bump CACHE_NAME so installed phones update');
});

check('the newest CHANGELOG entry matches BUILD_VERSION',()=>{
  assert.strictEqual(logged,build,'CHANGELOG.md newest entry is '+logged+' but BUILD_VERSION is '+build+': add a line for '+build);
});

process.stdout.write('\n'+passed+' version checks passed.\n');
