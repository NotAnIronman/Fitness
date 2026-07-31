/* ======================================================================
   SERVICE WORKER - Caches this app's own files so it still works offline. 
   ====================================================================== */

const CACHE_VERSION = 'forge-v9';

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
  './js/resttimer.js',
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

  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req)) // offline fallback only
  );
});
