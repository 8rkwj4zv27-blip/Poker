const CACHE_NAME = 'poker-v12-0';
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
  './js/08-dev-mode.js'
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
