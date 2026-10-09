"use strict";

// Classification and isolation contracts for the proposed card family.
// Browser layout / touch evidence lives in EVENT_CARD_LAB.md, not here.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('js/event-card-lab-model.js') + '\nthis.model=EventCardLabModel;', context);
const M = context.model;
let checks = 0;
function check(name, fn) { fn(); checks++; }
check('all classification axes are explicit and separately selectable', () => {
  assert.deepEqual(Array.from(M.axes.rarity), ['common','uncommon','rare','legendary']);
  assert.deepEqual(Array.from(M.axes.category), ['classic','format','wild','chaos','rival','variant']);
  assert.equal(M.axes.venue.length, 6);
});
for (const rarity of M.axes.rarity) for (const category of M.axes.category) for (const venue of M.axes.venue) {
  check(rarity + ' / ' + category + ' / ' + venue, () => {
    const original = M.fixtures[0];
    const card = M.withAxis(M.withAxis(M.withAxis(original,'rarity',rarity),'category',category),'venue',venue);
    assert.equal(card.rarity, rarity); assert.equal(card.category, category); assert.equal(card.venue, venue);
    // A finishing or classification choice must never imply new artwork,
    // stakes, hand rules, or a change to the stored source fixture.
    for (const k of ['id','art','artAlt','title','shortTitle','buyIn','top','seats']) assert.equal(card[k], original[k]);
    assert.equal(original.rarity, 'common'); assert.equal(original.category, 'classic'); assert.equal(original.venue, 'backroom');
    assert.ok(M.label(card).includes(rarity) && M.label(card).includes(category) && M.label(card).includes(M.venues[venue]));
  });
}
check('invalid values cannot silently invent classifications', () => {
  for (const [k,v] of [['rarity','mythic'],['category','legendary'],['venue','wild'],['art','anything']]) assert.throws(() => M.withAxis(M.fixtures[0],k,v));
});
check('illustrations are actual existing game assets', () => {
  M.fixtures.forEach(t => assert.ok(fs.existsSync(path.join(root,t.art))));
});
check('lab script has no transaction, save, poker-entry or navigation calls', () => {
  const controller = read('js/event-card-lab.js');
  assert.ok(!/\b(?:enterCareerEvent|startCareerEvent|saveCareer|newGame|applyAction|showCareerScreen|showScreen|localStorage|sessionStorage|Store)\s*[.(]/.test(controller));
  assert.ok(!/\bfetch\s*\(/.test(controller));
});
check('production and offline shell never load the new files', () => {
  for (const file of ['index.html','sw.js']) assert.ok(!read(file).includes('event-card-lab'));
});
check('lab reuses the host that shims storage before the game loads', () => {
  const html=read('event-card-lab.html'), host=read('js/hub-lab-host.js');
  assert.ok(html.includes('id="lab-inject"') && html.includes('js/hub-lab-host.js'));
  assert.ok(host.includes("source.replace(sw, '')") && host.includes("P.setItem = function(k, v){ mem[String(k)] = String(v); }"));
  assert.ok(host.indexOf("'<head><base") >= 0);
});
process.stdout.write(checks + ' event card classification and isolation checks passed.\n');
