/**
 * BOHNENSPEICHER - SERVICE WORKER (OFFLINE CACHING)
 */

const CACHE_NAME = 'bohnenschmiede-v45';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/js/utils.js',
  './assets/js/supabase.js',
  './assets/js/app.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/**
 * 1. Install Event: Robustes Einzel-Caching der App-Shell
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[Service Worker] Caching App Shell...');
      for (const asset of ASSETS_TO_CACHE) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[Service Worker] Konnte Ressource nicht cachen: ${asset}`, err);
        }
      }
    })
  );
  self.skipWaiting();
});

/**
 * 2. Activate Event: Alte Caches zuverlässig aufräumen
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Lösche alten Cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/**
 * 3. Fetch Event: Anfragen aus dem Cache bedienen (Cache First)
 */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
