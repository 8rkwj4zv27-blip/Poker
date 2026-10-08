#!/usr/bin/env node
"use strict";

/* Version checks. A release carries its version in three places, all
   bumped by hand: BUILD_VERSION (js/02-support-systems.js, shown in the
   main menu's footer), CACHE_NAME (sw.js, which makes installed phones
   fetch the new files) and the newest entry in CHANGELOG.md. If
   CACHE_NAME is forgotten, players keep the old game. If the CHANGELOG
   is forgotten, the record is wrong. This suite fails the moment the
   three disagree, or when the handover note (docs/HANDOVER.md) names
   another build.
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

// docs/HANDOVER.md is the note each session leaves the next (CLAUDE.md,
// "Handover note"). A release that forgets it leaves the next session
// planning from a stale picture of the game.
check('docs/HANDOVER.md names the current build',()=>{
  const note=read('docs/HANDOVER.md');
  const full=/const BUILD_VERSION = '([^']+)';/.exec(read('js/02-support-systems.js'))[1];
  const m=/^Build: `([^`]+)`$/m.exec(note);
  assert(m,'no "Build: `...`" line in docs/HANDOVER.md');
  assert.strictEqual(m[1],full,'docs/HANDOVER.md says '+m[1]+' but BUILD_VERSION is '+full+': update the handover note');
});

check('docs/HANDOVER.md stays one screen',()=>{
  const lines=read('docs/HANDOVER.md').split('\n').length;
  assert(lines<=80,'docs/HANDOVER.md is '+lines+' lines: replace old lines instead of adding (limit 80)');
});

process.stdout.write('\n'+passed+' version checks passed.\n');
