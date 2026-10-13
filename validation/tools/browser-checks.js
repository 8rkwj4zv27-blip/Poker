#!/usr/bin/env node
"use strict";
/* The browser checks, one after another: every suite and scenario that
   needs Playwright and Chromium (real touch in an emulated iPhone), which
   `npm test` can't run. GitHub runs this on every pull request
   (.github/workflows/tests.yml, "browser checks"); locally:

     npm run browser-checks

   Serves the repo root on 8768 for the suites that expect a server, and
   prints one line per check, then the total. Exits 1 if any fails, with
   the tail of its output. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8768;
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.PNG':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const CHECKS = [
  ['validation/career-hub-checks.cjs'],
  ['validation/pack-opening-checks.cjs'],
  ['validation/pack-ritual-touch-checks.cjs'],
  ['validation/vending-checks.cjs'],
  ['validation/tools/play-test.js'],
  ['validation/tools/new-career-scenario.js', '--sizes', '390x844'],
  ['validation/tools/invitation-scenario.js'],
  ['validation/tools/table-sweep.js'],
  ['validation/tools/tray-scenario.js']
];

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type':TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

function run(args){
  return new Promise(resolve => {
    const t0 = Date.now();
    const env = { ...process.env, VENDING_URL:'http://127.0.0.1:' + PORT + '/vending-lab.html' };
    const child = spawn(process.execPath, args, { cwd:ROOT, env });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', code => resolve({ code, out, secs:((Date.now() - t0) / 1000).toFixed(0) }));
  });
}

server.listen(PORT, '127.0.0.1', async () => {
  const failed = [];
  for (const args of CHECKS){
    const r = await run(args);
    const last = r.out.trim().split('\n').pop();
    console.log((r.code === 0 ? 'ok    ' : 'FAIL  ') + String(r.secs).padStart(4) + 's  ' + args[0] + '  ' + last);
    if (r.code !== 0) failed.push([args[0], r.out]);
  }
  server.close();
  failed.forEach(([name, out]) => { console.log('\n--- ' + name + ' ---\n' + out.trim().split('\n').slice(-30).join('\n')); });
  console.log('\n' + (CHECKS.length - failed.length) + ' of ' + CHECKS.length + ' browser checks passed.');
  process.exit(failed.length ? 1 : 0);
});
