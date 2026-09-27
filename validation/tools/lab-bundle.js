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

   PHONE-FIRST LABS (the owner's phone is where labs are looked at): a lab
   page that carries <script type="application/json" id="lab-inject">
   ({"css":[...],"js":[...]}) runs the game full screen in one frame and
   its controls inside the game. For those, game.html is BAKED here: the
   service worker stripped, the in-memory storage shim first in <head>,
   and the lab's parts before </body>, so the published link needs no
   nested srcdoc copy (which is what failed in the Claude app on a phone).
   The page gets window.LAB_STATIC = true and loads game.html directly.

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
const injectJson = (lab.match(/<script type="application\/json" id="lab-inject">([\s\S]*?)<\/script>/) || [])[1];
const inject = injectJson ? JSON.parse(injectJson) : null;
if (inject) inject.css.concat(inject.js).forEach(f => files.add(f));
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
const SHIM = `(function(){
    var mem = Object.create(null);
    mem['felt.settings'] = JSON.stringify({ sound:true, seenIntro:true });
    var P = Storage.prototype;
    P.getItem = function(k){ k = String(k); return k in mem ? mem[k] : null; };
    P.setItem = function(k, v){ mem[String(k)] = String(v); };
    P.removeItem = function(k){ delete mem[String(k)]; };
    P.clear = function(){ mem = Object.create(null); };
    P.key = function(i){ var k = Object.keys(mem)[i]; return k === undefined ? null : k; };
    try{ Object.defineProperty(P, 'length', { configurable:true, get:function(){ return Object.keys(mem).length; } }); }catch(e){}
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('lab')); }; }catch(e){} }
  })();`;
let gameOut = game;
if (inject){
  const sw = /<script id="pwa-service-worker">[\s\S]*?<\/script>/;
  if (!sw.test(game)) throw new Error('game page shape changed: no service-worker block to strip');
  const v = inject.v || '1';
  const strip = (inject.strip || []).reduce((h, f) => {
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return h.replace(new RegExp('<link rel="stylesheet" href="' + esc + '[^"]*">\\s*', 'g'), '')
            .replace(new RegExp('<script src="' + esc + '[^"]*"><\\/script>\\s*', 'g'), '');
  }, game);
  gameOut = strip.replace(sw, '')
    .replace(/<head>/i, '<head><script>' + SHIM + '<\/script>')
    .replace(/<\/body>/i, inject.css.map(f => '<link rel="stylesheet" href="' + f + '?v=' + v + '">').join('') +
      inject.js.map(f => '<script src="' + f + '?v=' + v + '"><\/script>').join('') + '</body>');
}
fs.writeFileSync(path.join(out, 'game.html'), gameOut);

// the lab page without its wrapper
const title = (lab.match(/<title>[\s\S]*?<\/title>/i) || [''])[0];
const head = (lab.match(/<head>([\s\S]*?)<\/head>/i) || ['', ''])[1];
const headParts = [...head.matchAll(/<style[\s\S]*?<\/style>|<link rel="stylesheet"[^>]*>|<script[\s\S]*?<\/script>/gi)].map(m => m[0]);
const bodyTag = (lab.match(/<body([^>]*)>/i) || ['', ''])[1];
const bodyClass = (bodyTag.match(/class="([^"]*)"/) || ['', ''])[1];
const body = (lab.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || ['', ''])[1];
const shim = '<script>(function(){' +
  (bodyClass ? 'document.body.className=' + JSON.stringify(bodyClass) + ';' : '') +
  // the game copy is game.html here (an Artifact reserves index.html)
  'var f=window.fetch;window.fetch=function(u,o){if(typeof u==="string"&&/(^|\\/)index\\.html$/.test(u.split(/[?#]/)[0]))u=u.replace(/index\\.html/,"game.html");return f.call(this,u,o);};' +
  'window.EC_LAB_GAME=window.SD_LAB_GAME=window.LAB_GAME="game.html";' + (inject ? 'window.LAB_STATIC=true;' : '') +
  '})();</script>';
const page = [title, '<meta name="theme-color" content="#140709">', shim, ...headParts, body.trim()].join('\n');
fs.writeFileSync(path.join(out, labName), page);

const published = ['game.html', ...list];
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(published, null, 1));
const bytes = published.reduce((s, f) => s + fs.statSync(path.join(out, f)).size, 0);
console.log('Staged ' + labName + ' + ' + published.length + ' files (' + (bytes / 1048576).toFixed(1) + ' MB) in ' + out);
if (published.length > 255) console.warn('More than 255 files: publish in two calls to the same url.');
