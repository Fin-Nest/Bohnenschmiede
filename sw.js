/**
 * BOHNENSCHMIEDE - SERVICE WORKER (OFFLINE CACHING)
 */

const CACHE_NAME = 'bohnenschmiede-v1';

// Statische Ressourcen, die für die Offline-Nutzung lokal zwischengespeichert werden
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/js/utils.js',
  './assets/js/supabase.js',
  './assets/js/app.js',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'
];

/**
 * 1. Install Event: Cache öffnen und App-Shell-Ressourcen speichern
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
 * 2. Activate Event: Alte Caches aufräumen bei Versions-Updates
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
 * 3. Fetch Event: Anfragen abfangen (Cache-First Strategie für App Shell)
 */
self.addEventListener('fetch', (event) => {
  // Nur GET-Anfragen zwischenspeichern (keine POST/PUT-Requests an Supabase)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Wenn Datei im Cache vorhanden ist: Aus dem Cache liefern
      if (cachedResponse) {
        return cachedResponse;
      }

      // Sonst über das Netzwerk laden
      return fetch(event.request).catch(() => {
        // Fallback bei Verbindungsabbruch beim Navigieren
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
