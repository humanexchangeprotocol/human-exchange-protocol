// HEP Service Worker
// Version-stamped cache. Bump CACHE_VERSION on each release.
const CACHE_VERSION = '2.37.0-tabs9';
const CACHE_NAME = 'hep-v' + CACHE_VERSION;

// Files to cache on install
const CORE_ASSETS = [
  './',
  './index.html',
  './hep-core.js',
  './hep-app.js',
  './vendor/qrcode.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: cache core assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CORE_ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key.startsWith('hep-v') && key !== CACHE_NAME;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: cache-first for app assets, network-only for API calls
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Never cache witness server, version checks, or external API calls
  if (url.hostname !== self.location.hostname) {
    return;
  }

  // Never cache POST/PUT/DELETE
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then(function(response) {
        // Only cache successful same-origin responses
        if (response.ok && url.hostname === self.location.hostname) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(function() {
      // Offline fallback: return cached index for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
