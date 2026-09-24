"use strict";
/* Lay out every PNG in a directory (optionally filtered by filename prefix)
   as one grid image, so a whole animation sequence can be reviewed in one
   look instead of opening N separate screenshots — each image reviewed
   individually costs real tokens, so batching into one sheet is the cheap
   default.

   Usage: node validation/tools/contact-sheet.js <shotsDir> <outFile.png> [prefix] [cols]

   Requires the pre-installed Chromium (see touch-harness.js) but no extra
   image-processing dependency — it just renders an HTML <img> grid and
   screenshots the page.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { findChromium } = require('./touch-harness');

async function main() {
  const [shotsDir, outFile, prefix = '', colsArg] = process.argv.slice(2);
  if (!shotsDir || !outFile) {
    console.error('Usage: node contact-sheet.js <shotsDir> <outFile.png> [prefix] [cols]');
    process.exit(1);
  }
  const files = fs.readdirSync(shotsDir).filter(f => f.endsWith('.png') && f.startsWith(prefix)).sort();
  if (!files.length) { console.error('No matching PNGs in ' + shotsDir); process.exit(1); }
  const cols = Number(colsArg) || Math.min(6, files.length);
  const cellW = 215;
  const html = '<body style="margin:0;background:#000;display:grid;' +
    `grid-template-columns:repeat(${cols},${cellW}px);gap:4px;color:#fff;font:12px monospace">` +
    files.map(f => `<div><img src="file://${path.resolve(shotsDir, f)}" style="width:${cellW}px">` +
      `<br>${f.slice(prefix.length)}</div>`).join('') + '</body>';
  const tmpHtml = path.join(shotsDir, '.contact-sheet.html');
  fs.writeFileSync(tmpHtml, html);
  const browser = await chromium.launch({ executablePath: findChromium() });
  try {
    const page = await browser.newPage({ viewport: { width: cellW * cols, height: 1000 } });
    await page.goto('file://' + tmpHtml);
    await page.waitForTimeout(200);
    await page.screenshot({ path: outFile, fullPage: true });
  } finally {
    await browser.close();
    fs.unlinkSync(tmpHtml);
  }
  console.log('Wrote ' + outFile + ' (' + files.length + ' frames, ' + cols + ' cols).');
}
main();
