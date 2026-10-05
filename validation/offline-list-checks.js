#!/usr/bin/env node
"use strict";

/* Offline list checks (index.html vs sw.js APP_SHELL). The installed app
   plays offline from whatever sw.js precaches, and both files list every
   shipped file with a hand-bumped ?v= tag. A file or tag that drifts
   between the two gives an installed player a stale or half-updated game,
   so this suite fails the moment they disagree.
   Run: node validation/offline-list-checks.js */

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }

const indexHtml=read('index.html');
const sw=read('sw.js');

// file path without ./ and without ?v= / #hash
const bare=u=>u.replace(/^\.\//,'').replace(/[?#].*$/,'');
const tag=u=>{ const m=/\?v=([^#]*)/.exec(u); return m ? m[1] : ''; };

// index.html: every local src/href (stylesheets, scripts, manifest, icons)
const indexRefs=[...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1])
  .filter(u=>!/^(https?:|data:|mailto:|#)/.test(u));

// sw.js: the APP_SHELL array, with // comments removed (they contain
// apostrophes that would otherwise read as string quotes)
const shellMatch=sw.match(/const APP_SHELL\s*=\s*\[([\s\S]*?)\n\];/);
const shellBody=shellMatch ? shellMatch[1].replace(/\/\/.*$/gm,'') : '';
const shell=[...shellBody.matchAll(/'([^']*)'/g)].map(m=>m[1]);

check('sw.js has a CACHE_NAME and an APP_SHELL list',()=>{
  assert.ok(/const CACHE_NAME\s*=\s*'[^']+'/.test(sw),'CACHE_NAME missing or malformed');
  assert.ok(shellMatch,'APP_SHELL array not found');
  assert.ok(shell.length>80,'APP_SHELL looks truncated: '+shell.length+' entries');
});

check('APP_SHELL lists each file once',()=>{
  const seen=new Set(), dupes=[];
  shell.forEach(u=>{ const k=bare(u); if (seen.has(k)) dupes.push(k); seen.add(k); });
  assert.deepStrictEqual(dupes,[],'listed twice: '+dupes.join(', '));
});

check('every file index.html loads is precached by sw.js',()=>{
  const cached=new Set(shell.map(bare));
  const missing=indexRefs.map(bare).filter(f=>!cached.has(f));
  assert.deepStrictEqual(missing,[],'not in APP_SHELL: '+missing.join(', '));
});

check('index.html and sw.js carry the same ?v= tag for every file',()=>{
  const shellTag=new Map(shell.map(u=>[bare(u),tag(u)]));
  const drift=indexRefs.filter(u=>shellTag.has(bare(u)) && shellTag.get(bare(u))!==tag(u))
    .map(u=>bare(u)+' (index.html "'+tag(u)+'", sw.js "'+shellTag.get(bare(u))+'")');
  assert.deepStrictEqual(drift,[],'tag mismatch: '+drift.join('; '));
});

check('every precached file exists on disk',()=>{
  const missing=shell.map(bare).filter(f=>f && !fs.existsSync(path.join(root,f)));
  assert.deepStrictEqual(missing,[],'missing: '+missing.join(', '));
});

check('the only precached files index.html does not load are the page, the large icon and faces',()=>{
  const loaded=new Set(indexRefs.map(bare));
  const extra=shell.map(bare).filter(f=>!loaded.has(f) && f!=='' && f!=='index.html' && f!=='icon-512.png' && !f.startsWith('assets/faces/'));
  assert.deepStrictEqual(extra,[],'precached but never loaded: '+extra.join(', '));
});

check('every face the game draws is precached',()=>{
  // the face art tables in js/02-support-systems.js name every portrait file
  const support=read('js/02-support-systems.js');
  const faces=[...new Set([...support.matchAll(/'(assets\/faces\/[^']+)'/g)].map(m=>m[1]))];
  assert.ok(faces.length>20,'face table not found');
  const cached=new Set(shell.map(bare));
  const missing=faces.filter(f=>!cached.has(f));
  assert.deepStrictEqual(missing,[],'faces not precached: '+missing.join(', '));
});

check('no Lab page or Lab-only file is shipped',()=>{
  const lab=u=>/-lab(-host|-frame)?\.(html|js|css)$/.test(bare(u));
  const shipped=[...indexRefs,...shell].filter(lab);
  assert.deepStrictEqual(shipped,[],'Lab file shipped: '+shipped.join(', '));
});

process.stdout.write('\n'+passed+' offline list checks passed.\n');
