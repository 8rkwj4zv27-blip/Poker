const CACHE_NAME = 'poker-v15-2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './css/01-foundation.css',
  './css/02-screens.css',
  './css/03-action-console.css',
  './css/04-overlays-and-modes.css',
  './css/05-responsive-and-arcade.css',
  './js/01-poker-math.js',
  './js/02-support-systems.js',
  './js/03-opponents.js',
  './js/04-modes-and-scoring.js',
  './js/05-game-engine.js',
  './js/06-presentation.js',
  './js/07-ui-wiring.js',
  './js/08-dev-mode.js',
  // FACE_ART (js/02-support-systems.js) — every illustrated portrait an
  // opponent can wear, precached so a live seat's expression can always
  // swap from Cache Storage rather than depending on a network round-trip
  // (see swapFace()/loadImage() in 02-support-systems.js for the atomic
  // swap itself, which is what actually guarantees no blank portrait —
  // this precache only shrinks how often that swap has to wait at all).
  './assets/faces/legacy-idle.jpg',
  './assets/faces/legacy-think.jpg',
  './assets/faces/legacy-happy.jpg',
  './assets/faces/legacy-smug.jpg',
  './assets/faces/legacy-sad.jpg',
  './assets/faces/legacy-shock.jpg',
  './assets/faces/legacy-angry.jpg',
  './assets/faces/legacy-dead.jpg',
  './assets/faces/red-thinking01.PNG',
  './assets/faces/red-thinking02.PNG',
  './assets/faces/red-worried01.PNG',
  './assets/faces/red-shocked01.PNG',
  './assets/faces/red-furious01.PNG',
  './assets/faces/red-tilted01.PNG',
  './assets/faces/red-sly01.PNG',
  './assets/faces/red-gloating01.PNG',
  './assets/faces/red-dead01.PNG',
  './assets/faces/red-dead02.PNG',
  './assets/faces/red-dead03.PNG',
  // expression pack 0242-0275 — the mood/reaction system draws from these
  // constantly, so they precache alongside the originals above
  './assets/faces/0242-worried.PNG',
  './assets/faces/0243-nervous.PNG',
  './assets/faces/0244-panic.PNG',
  './assets/faces/0245-suspicious.PNG',
  './assets/faces/0246-smug.PNG',
  './assets/faces/0247-very-nervous.PNG',
  './assets/faces/0248-cocky.PNG',
  './assets/faces/0249-neutral.PNG',
  './assets/faces/0250-neutral.PNG',
  './assets/faces/0251-scheming.PNG',
  './assets/faces/0252-happy.PNG',
  './assets/faces/0253-confused.PNG',
  './assets/faces/0254-confused.PNG',
  './assets/faces/0255-happy-confused.PNG',
  './assets/faces/0256-ecstatic.PNG',
  './assets/faces/0257-cocky.PNG',
  './assets/faces/0258-sly.PNG',
  './assets/faces/0259-gloating.PNG',
  './assets/faces/0260-manic.PNG',
  './assets/faces/0261-nervous.PNG',
  './assets/faces/0262-suspicious.PNG',
  './assets/faces/0263-relieved.PNG',
  './assets/faces/0264-neutral.PNG',
  './assets/faces/0265-neutral.PNG',
  './assets/faces/0266-neutral.PNG',
  './assets/faces/0267-happy.PNG',
  './assets/faces/0268-baffled.PNG',
  './assets/faces/0269-nervous.PNG',
  './assets/faces/0270-very-nervous.PNG',
  './assets/faces/0271-angry.PNG',
  './assets/faces/0272-shocked.PNG',
  './assets/faces/0273-terrified.PNG',
  './assets/faces/0274-joyful.PNG',
  './assets/faces/0275-displeased.PNG'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Network-first for page navigations so new GitHub Pages deploys appear quickly.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Network-first for local static assets too (JS/CSS/images), falling
  // back to the cache only when the network request actually fails —
  // same philosophy as the navigation handler above, now applied
  // consistently everywhere. This used to be cache-first with a
  // background refetch ("stale-while-revalidate"): a real deploy's new
  // JS/CSS would sit unseen in Cache Storage until a SECOND load
  // (whichever page load triggered the background refetch never itself
  // benefited from it), which is what let a stale build linger
  // indefinitely for anyone who doesn't reload repeatedly. Network-first
  // means an online visit always gets the current deployed file
  // immediately; the cache is now purely an offline fallback, not a
  // freshness bottleneck — offline play is unaffected, since a failed
  // fetch (no network) still falls back to whatever was last cached.
  if (new URL(req.url).origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      }).catch(() => caches.match(req))
    );
  }
});
