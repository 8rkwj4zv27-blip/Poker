#!/usr/bin/env node
"use strict";

/* Runs every check suite in validation/ (one `node` process each) and
   prints one line per suite, then the total. Exits 1 if any suite fails,
   with the tail of its output, so `npm test` (and CI) go red.
   Run: npm test               all suites, about 4 minutes
        npm run test:quick     skips the three long AI/coach simulations
        node validation/run-all.js scoring showdown   only suites whose name contains a word */

const fs=require('fs');
const path=require('path');
const { spawnSync }=require('child_process');

const dir=__dirname;
// The long simulations: hundreds of thousands of dealt hands each.
const SLOW=['ai-behaviour-checks.js','ai-tier-checks.js','coach-brain-checks.js'];

const args=process.argv.slice(2);
const quick=args.includes('--quick');
const filters=args.filter(a=>!a.startsWith('--'));

const suites=fs.readdirSync(dir)
  .filter(f=>f.endsWith('.js') && f!=='run-all.js')
  .filter(f=>!quick || !SLOW.includes(f))
  .filter(f=>!filters.length || filters.some(w=>f.includes(w)))
  .sort();

if (!suites.length){ console.error('No suites match.'); process.exit(1); }

const failed=[];
const started=Date.now();
for (const f of suites){
  const t0=Date.now();
  const run=spawnSync(process.execPath,[path.join(dir,f)],{ encoding:'utf8', maxBuffer:64*1024*1024 });
  const secs=((Date.now()-t0)/1000).toFixed(1).padStart(5);
  const out=(run.stdout||'')+(run.stderr||'');
  const lines=out.trim().split('\n');
  // each suite ends with a summary line ("170 Phase 4 scoring checks passed.")
  const summary=(lines.filter(l=>/passed|DIVERGENCES/.test(l)).pop() || lines.pop() || '').trim();
  if (run.status===0){
    process.stdout.write('ok    '+secs+'s  '+f.replace(/\.js$/,'')+'  '+summary+'\n');
  } else {
    failed.push(f);
    process.stdout.write('FAIL  '+secs+'s  '+f.replace(/\.js$/,'')+'\n');
    process.stdout.write(lines.slice(-25).map(l=>'      | '+l).join('\n')+'\n');
  }
}

const total=((Date.now()-started)/1000).toFixed(0);
process.stdout.write('\n'+(suites.length-failed.length)+' of '+suites.length+' suites passed in '+total+'s'+(quick?' (quick: long simulations skipped)':'')+'.\n');
if (failed.length){ process.stdout.write('Failed: '+failed.join(', ')+'\n'); process.exit(1); }
