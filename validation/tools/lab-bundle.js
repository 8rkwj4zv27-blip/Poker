"use strict";
/* Stage a visual Lab for publishing as a private Artifact (a claude.ai
   link the owner opens on the phone). This is how the owner wants to
   receive every visual lab: see "Visual labs" in CLAUDE.md.

   Usage: node validation/tools/lab-bundle.js <lab.html> <outDir>

   Writes into <outDir> (use the session's scratchpad):
     - the lab page, with its document wrapper taken off (the Artifact
       publish adds its own <!doctype>/<head>/<body>): its <title>, its
       stylesheets and scripts, its body markup, and a line that puts the
       body's class back
     - game.html: a copy of index.html (an Artifact's index.html is
       reserved). A small shim in the lab page sends the lab's
       fetch('index.html') to game.html, so no lab has to change.
     - every file the game and the lab load: css/, js/, the icons and
       manifest, and assets/ (minus assets/chips/_old)
     - files.json: the list of published paths, for the Artifact tool's
       `files` (with `root` = <outDir>)

   Then publish (Claude): Artifact publish with file_path <outDir>/<lab>.html,
   root <outDir>, files = the list in files.json. Republishing the same
   file path in a session updates the same link.
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const [labArg, outArg] = process.argv.slice(2);
if (!labArg || !outArg){ console.error('Usage: node lab-bundle.js <lab.html> <outDir>'); process.exit(1); }
const labName = path.basename(labArg);
const out = path.resolve(outArg);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const lab = read(labName);
const game = read('index.html');

const files = new Set();
const local = u => u && !/^(https?:|data:|#|mailto:|\/\/)/.test(u) ? u.split(/[?#]/)[0] : null;
const refs = html => [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => local(m[1])).filter(Boolean);
refs(game).forEach(f => files.add(f));
refs(lab).forEach(f => files.add(f));
// files a lab script injects into the game copy (its candidate parts)
refs(lab).filter(f => f.endsWith('.js')).forEach(f => {
  const src = read(f);
  [...src.matchAll(/['"`=]((?:css|js)\/[A-Za-z0-9_.-]+\.(?:css|js))/g)].forEach(m => files.add(m[1]));
});
// assets the scripts and styles ask for by name (faces, chips)
(function walk(dir){
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes:true }).forEach(e => {
    const p = dir + '/' + e.name;
    if (e.isDirectory()){ if (e.name !== '_old') walk(p); }
    else files.add(p);
  });
})('assets');
files.delete('index.html'); files.delete(labName);
['icon-512.png'].forEach(f => { if (fs.existsSync(path.join(ROOT, f))) files.add(f); });

fs.mkdirSync(out, { recursive:true });
const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(out, to)), { recursive:true }); fs.copyFileSync(path.join(ROOT, from), path.join(out, to)); };
const list = [...files].filter(f => { const ok = fs.existsSync(path.join(ROOT, f)); if (!ok) console.warn('missing, skipped: ' + f); return ok; }).sort();
list.forEach(f => copy(f, f));
fs.writeFileSync(path.join(out, 'game.html'), game);

// the lab page without its wrapper
const title = (lab.match(/<title>[\s\S]*?<\/title>/i) || [''])[0];
const head = (lab.match(/<head>([\s\S]*?)<\/head>/i) || ['', ''])[1];
const headParts = [...head.matchAll(/<link rel="stylesheet"[^>]*>|<script[\s\S]*?<\/script>/gi)].map(m => m[0]);
const bodyTag = (lab.match(/<body([^>]*)>/i) || ['', ''])[1];
const bodyClass = (bodyTag.match(/class="([^"]*)"/) || ['', ''])[1];
const body = (lab.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || ['', ''])[1];
const shim = '<script>(function(){' +
  (bodyClass ? 'document.body.className=' + JSON.stringify(bodyClass) + ';' : '') +
  // the game copy is game.html here (an Artifact reserves index.html)
  'var f=window.fetch;window.fetch=function(u,o){if(typeof u==="string"&&/(^|\\/)index\\.html$/.test(u.split(/[?#]/)[0]))u=u.replace(/index\\.html/,"game.html");return f.call(this,u,o);};' +
  'window.EC_LAB_GAME=window.SD_LAB_GAME=window.LAB_GAME="game.html";' +
  '})();</script>';
const page = [title, '<meta name="theme-color" content="#140709">', shim, ...headParts, body.trim()].join('\n');
fs.writeFileSync(path.join(out, labName), page);

const published = ['game.html', ...list];
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(published, null, 1));
const bytes = published.reduce((s, f) => s + fs.statSync(path.join(out, f)).size, 0);
console.log('Staged ' + labName + ' + ' + published.length + ' files (' + (bytes / 1048576).toFixed(1) + ' MB) in ' + out);
if (published.length > 255) console.warn('More than 255 files: publish in two calls to the same url.');
