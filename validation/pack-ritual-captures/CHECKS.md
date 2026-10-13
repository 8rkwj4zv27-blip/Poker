# Pack Ritual checks — 11 October 2026

- Baseline: fetched `origin/main`, still `18de0d4`; lab branch based on it.
  Production `BUILD_VERSION`: `v0.67.0-dev · Back Room builds a stack`.
- Before pass: `npm test` **25/25**, 245 seconds, exit 0.
- Post-pass full `npm test`: **24/25**, 263 seconds. The only failure was
  the new `docs/HANDOVER.md` reaching 83 lines (limit 80). All simulation,
  poker, save, offline and component suites passed.
- Corrected the document length, then `npm test -- version`: **1/1**,
  all seven version/handover assertions passed, exit 0.
- Final `npm run test:quick`: **22/22**, 21 seconds, exit 0. The three long
  simulation suites had already passed the post-pass full run; no game or
  simulation code changed. All 25 suites are consequently verified green
  across the full run and focused rechecks. A second full long-simulation
  run was not performed just for the document-length correction.
- Final `node validation/pack-ritual-touch-checks.cjs`: exit 0. Uses the
  shared touch harness with an installed Chromium path, no new package.
  Normal-motion 390×844: four packs, all sixteen combinations. Normal and
  reduced-motion 375×667: full loop each. No page/console errors. See
  `QA.json`. Sound switched off during checks: Rare/Legendary visibility
  assertions do not depend on audio.
- Touch QA caught a stripped `home-cast.js` dependency (`initHeroFaces`)
  and a reduced-motion manual-turn delay. Both were fixed and the entire
  browser suite rerun successfully before the final push.
- Bundler: `node validation/tools/lab-bundle.js pack-ritual-lab.html
  /tmp/bundle-pack-ritual` succeeded on final source; 167 accompanying
  files, 5.4 MB. Manifest committed as `bundle-files.json`.
- `node --check` on the lab scripts passed. Production `index.html`,
  `sw.js`, game logic, save schema, JS and CSS unchanged.

Evidence: 32 PNGs, 16 stages at each normal-motion phone size. Numbered
01 packets; 02 buy; 03 mid-rip; 04 mouth; 05 extraction; 06 Common;
07 inspection; 08 angle; 09 neutral reverse; 10 Rare; 11 Legendary;
12 chips; 13 spread; 14 Legendary inspection; 15 filing; 16 collection.
The captures intentionally include transient motion frames. Shared CRT
changes can leave brief ghost text in those frames.

Not checked: physical iPhone Safari/PWA, Artifact app, 120Hz, sound quality,
haptics, performance/battery or repeated-play delight. The owner's new
subjective rating is pending. No claim of 9.99/10 or production approval.
