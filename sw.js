/* ============================================================
   SERVICE WORKER
   Caches this app's own files (the "app shell") so it works offline
   and loads instantly once installed. Cross-origin requests (Google
   Fonts, Chart.js CDN, the USDA food API) are left alone and just go
   straight to the network, this only takes ownership of files that
   live in this repo.

   Bump CACHE_VERSION any time app files change - that's what makes
   an already-installed copy pick up updates instead of being stuck
   on whatever was cached at install time.
   ============================================================ */

const CACHE_VERSION = 'forge-v5';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/data.js',
  './js/storage.js',
  './js/calc.js',
  './js/theme.js',
  './js/gamestats.js',
  './js/app.js',
  './js/workouts.js',
  './js/log.js',
  './js/progress.js',
  './js/goals.js',
  './js/food.js',
  './js/barcode.js',
  './js/bodyfat.js',
  './js/pet.js',
  './js/achievements.js',
  './js/themes.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin requests pass through untouched

  // Cache-first for the app's own files, with a background refresh so updates
  // still make it into the cache for next time (stale-while-revalidate).
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
