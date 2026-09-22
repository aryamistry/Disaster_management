// NER Landslide Field Reporter — Service Worker (FIX-4.1)
// Provides offline-first capability: caches app shell on install,
// serves from cache when network is unavailable.

const CACHE_NAME = 'ner-field-reporter-v1';

// App shell assets to pre-cache on install
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
];

// ---- Install: pre-cache the app shell ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can; fonts may fail in some environments — that's okay
      return cache.addAll(APP_SHELL).catch(err => {
        console.warn('[SW] Some app shell assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ---- Activate: clean up old caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch: app shell = cache-first; API = network-first ----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and cross-origin requests we don't control
  if (event.request.method !== 'GET') return;

  // API requests: network-first, no caching (dynamic data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ success: false, error: 'Offline — API unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // App shell: cache-first strategy so the form loads even with no network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(networkResponse => {
        // Cache successful responses for the app shell
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // If both cache and network fail, return index.html so the SPA can handle it
        return caches.match('./index.html');
      });
    })
  );
});
