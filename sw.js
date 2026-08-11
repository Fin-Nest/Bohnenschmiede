/**
 * BOHNENSCHMIEDE - SERVICE WORKER (OFFLINE CACHING)
 */

// Versionsnummer erhöhen, damit der Browser den alten Cache verwirft und neu lädt
const CACHE_NAME = 'bohnenschmiede-v31';

// Nur lokale App-Shell-Dateien & neue Icons zwischenspeichern
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
 * 1. Install Event: Lokale App-Shell im Cache speichern
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

/**
 * 2. Activate Event: Alte Caches aufräumen
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
 * 3. Fetch Event: Anfragen aus dem Cache bedienen
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
