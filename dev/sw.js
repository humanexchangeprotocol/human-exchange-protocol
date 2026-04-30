// HEP Service Worker — DEV BUILD
// Version-stamped cache. Bump CACHE_VERSION on each release.
const CACHE_VERSION = '2.61.20';
const CACHE_NAME = 'hep-dev-v' + CACHE_VERSION;

// Files to cache on install
const CORE_ASSETS = [
  './',
  './index.html',
  './hep-core.js',
  './hep-app.js',
  './vendor/qrcode.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './favicon.ico',
  './favicon-32.png',
  './favicon-16.png'
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
          return key.startsWith('hep-dev-v') && key !== CACHE_NAME;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: network-first for core app files, cache-first for static assets
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

  // Core app files: network-first (always get latest when online)
  var path = url.pathname.replace(/.*\//, ''); // filename only
  var isCore = (path === '' || path === 'index.html' || path === 'hep-core.js' || path === 'hep-app.js' || path === 'sw.js');

  if (isCore || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline: serve from cache
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Static assets (icons, vendor libs): cache-first (fast, rarely change)
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then(function(response) {
        if (response.ok && url.hostname === self.location.hostname) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(function() {
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
