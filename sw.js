const CACHE_NAME = 'poker-v11-6';
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

  // Cache-first for local static assets; refresh cache in the background.
  if (new URL(req.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
