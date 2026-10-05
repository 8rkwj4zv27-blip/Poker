# Source art

Original artwork by the owner that the game does not load. Nothing here is
shipped to players or precached by `sw.js`; it is kept as the originals.

- `faces/`: the blue, purple and yellow face sets (32 PNGs). The game draws
  every face colour by tinting the red set and the 0242–0275 expression pack
  in code (`FACE_COLORS` and `FACE_SOURCE_FAMILIES`,
  `js/02-support-systems.js`), so these are not needed at runtime. Six of
  them appear in the Career Hub V2 Lab (`career-hub-v2-lab.html`, via
  `js/career-hub-v2-lab.js`), which loads them from here.

Everything the game does load lives in `assets/`. A face moved back into
`assets/faces/` for use in the game must also be added to `sw.js`'s
`APP_SHELL`; `validation/offline-list-checks.js` enforces that for every
face the game names.
