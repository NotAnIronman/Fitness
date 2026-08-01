/* ============================================================
   SERVICE WORKER
   Caches this app's own files so it still works offline. Cross-origin
   requests (Google Fonts, Chart.js CDN, USDA/Open Food Facts/ZXing)
   are left alone and go straight to the network, this only takes
   ownership of files that live in this repo.

   Strategy: network-first for this app's own files. Whenever there's
   a connection, the freshest deployed version is always fetched and
   shown (and the cache is refreshed alongside it); the cache is only
   used as a fallback when there's no network at all. An earlier
   version of this file used cache-first, which served the cached
   copy forever once anything was cached, the background network
   fetch updated the cache but that updated copy was never actually
   displayed, so redeploys never visibly showed up. Don't reintroduce
   that.

   Bump CACHE_VERSION any time app files change - that's what makes
   an already-installed copy fully replace its old cached files (old
   cache buckets get deleted on activate) and is a quick way to
   confirm a deploy went out (see the version tooltip on the FORGE
   logo in the app, which reads APP_VERSION in js/app.js, keep that
   in sync with this).
   ============================================================ */

const CACHE_VERSION = 'forge-v17';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './assets/us-states-cc0.svg',
  './js/data.js',
  './js/storage.js',
  './js/calc.js',
  './js/guidance.js',
  './js/theme.js',
  './js/gamestats.js',
  './js/app.js',
  './js/health.js',
  './js/workouts.js',
  './js/resttimer.js',
  './js/log.js',
  './js/progress.js',
  './js/goals.js',
  './js/food.js',
  './js/barcode.js',
  './js/bodyfat.js',
  './js/pet.js',
  './js/onboarding.js',
  './js/achievements.js',
  './js/themes.js',
  './js/vendor/chart.umd.min.js',
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
